import { ipcMain, Menu, MenuItem, MenuItemConstructorOptions, dialog, app } from 'electron';
import fs from 'fs';
import fsPromise from 'fs/promises';
import Path from 'path';
import winston from 'winston';

import Flow from './lib/Flow';
import Folder from './lib/Folder';
import GVar from './lib/GVar';
import Context from './lib/Context/Context';
import VarTimestamp from './lib/Context/VarTimestamp';
import VarStreamTitle from './lib/Context/VarStreamTitle';
import VarStreamGame from './lib/Context/VarStreamGame';
import VarStreamUptime from './lib/Context/VarStreamUptime';
import { VarFormatDate, VarFormatTime, VarFormatDateTime, VarFormatSince, VarFormatUntil } from './lib/Context/VarDateTimeFormat';
import FlowDebug, { FlowDebugData } from './lib/FlowDebug';

import { IBroadcastArgument } from '../../dist/dev.pakl.ttvst/main/BroadcastMain';
import TTVSTMain from '../../dist/dev.pakl.ttvst/main/TTVSTMain';
import ExecutionScheduler from './lib/ExecutionScheduler';

declare var TTVST: TTVSTMain;
declare var logger: winston.Logger;

class Chatbot {

	registering = false;
	redoRegistering = false;
	flows: Array<Flow> = [];
	broadcastListeners: { [channel: string]: Array<(...args: any[]) => void> } = {};
	lastExecution: { [flowkey: string]: number } = {};
	debugData: { [flow: string]: FlowDebug } = {};

	executionScheduler: ExecutionScheduler;

	constructor() {
		this.executionScheduler = new ExecutionScheduler(this);

		this.registerFlow = this.registerFlow.bind(this);
		this.openContextMenu = this.openContextMenu.bind(this);
		this.onGetChannelPointRewards = this.onGetChannelPointRewards.bind(this);
		this.onGetContextForDynamicInput = this.onGetContextForDynamicInput.bind(this);
		this.onGetDebug = this.onGetDebug.bind(this);
		
		this.onExportData = this.onExportData.bind(this);
		this.onImportData = this.onImportData.bind(this);
		this.onBackupData = this.onBackupData.bind(this);

		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'ChatBot', status: 'error', title: 'Chatbot', info: 'Waiting for interface', buttons: [] });
		ipcMain.on('app.ttvst.chatbot.registerFlows', this.registerFlow);

		ipcMain.on('app.ttvst.chatbot.contextMenu', this.openContextMenu);
		ipcMain.handle('app.ttvst.chatbot.getChannelPointRewards', this.onGetChannelPointRewards);
		ipcMain.handle('app.ttvst.chatbot.getContextForDynamicInput', this.onGetContextForDynamicInput);
		ipcMain.handle('app.ttvst.chatbot.getDebug', this.onGetDebug);

		ipcMain.handle('app.ttvst.chatbot.exportdata', this.onExportData);
		ipcMain.handle('app.ttvst.chatbot.importdata', this.onImportData);
		ipcMain.handle('app.ttvst.chatbot.backupdata', this.onBackupData);
	}

	private async registerFlow() {
		if(this.registering) {
			this.redoRegistering = true;
			return;
		}
		this.registering = true;

		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'ChatBot', status: 'warn', title: 'Chatbot', info: 'Registering flows', buttons: [] });

		logger.debug('[Chatbot] Clear debug info');
		this.debugData = {};

		logger.info('[Chatbot] Resetting flows');
		logger.debug('[Chatbot] Removing flow actions');
		for(let i = 0; i < this.flows.length; i++) {
			let f = this.flows[i];
			TTVST.BroadcastMain.removeAction('app.ttvst.chatbot.flow.' + f.key);
		}
		logger.debug('[Chatbot] Removing broadcast listener');
		for(let channel of Object.keys(this.broadcastListeners)) {
			for(let i = 0; i < this.broadcastListeners[channel].length; i++) {
				TTVST.BroadcastMain.instance.off(channel, this.broadcastListeners[channel][i]);
			}
		}

		this.flows = [];
		this.broadcastListeners = {};

		logger.debug('[Chatbot] Loading all flows');
		let flows = await Flow.getAll(undefined);
		
		logger.debug('[Chatbot] Registering flow actions and adding broadcast listeners');
		for(let i = 0; i < flows.length; i++) {
			let f = flows[i];

			if(!(await this.isActive(f))) {
				continue;
			}

			this.flows.push(f);

			let listener = this.createListener(f);
			let parameters: Array<IBroadcastArgument> = [];
			if(f.trigger.length > 0) {
				let trigger = TTVST.BroadcastMain.getTrigger({ channel: f.trigger });
				if(trigger.length > 0) {
					parameters = trigger[0].arguments;
				}
				TTVST.BroadcastMain.instance.on(f.trigger, listener);

				if(!this.broadcastListeners.hasOwnProperty(f.trigger)) this.broadcastListeners[f.trigger] = [];
				this.broadcastListeners[f.trigger].push(listener);
			}

			let flowChannel = 'app.ttvst.chatbot.flow.' + f.key;
			if(!this.broadcastListeners.hasOwnProperty(flowChannel)) this.broadcastListeners[flowChannel] = [];
			this.broadcastListeners[flowChannel].push(listener);
			TTVST.BroadcastMain.instance.on('app.ttvst.chatbot.flow.' + f.key, listener);
			TTVST.BroadcastMain.registerAction({
				addon: 'chatbot',
				channel: 'app.ttvst.chatbot.flow.' + f.key,
				description: '',
				label: f.name,
				parameters
			});
		}
		
		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'ChatBot', status: 'good', title: 'Chatbot', info: '{{flows}} active flows registered', infoValues: { flows: this.flows.length }, buttons: [{ icon: 'Refresh', action: 'app.ttvst.chatbot.registerFlows', title: 'Reregister' }] });

		this.registering = false;
		if(this.redoRegistering) {
			this.redoRegistering = false;
			this.registerFlow();
		}
	}

	private async isActive(flowOrFolder: Flow|Folder): Promise<boolean> {
		if(!flowOrFolder.active) {
			return false;
		}
		if(flowOrFolder.superior < 0) {
			return true;
		}

		let folder = await Folder.get(flowOrFolder.superior);
		return this.isActive(folder);
	}

	private async createContext(flow: Flow = null, ... args: any[]): Promise<Context> {
		let context = new Context();

		if(flow !== null) {
			if(typeof(this.debugData[flow.key.toString()]) === 'undefined') {
				this.debugData[flow.key.toString()] = new FlowDebug();
			}
			context.setDebug(this.debugData[flow.key.toString()]);

			if(flow.trigger.length > 0) {
				let argobj = TTVST.BroadcastMain.argumentsToObject(flow.trigger, ...args);
				for(let name of Object.keys(argobj)) {
					context.setValueOf(name, argobj[name]);
				}
			}

			let lastExecution = 0;
			if(this.lastExecution.hasOwnProperty(flow.key.toString())) lastExecution = this.lastExecution[flow.key.toString()];

			context.setValueOf('FlowName', flow.name);
			context.setValueOf('LastExecutionTime', lastExecution);
			context.setValueOf('SecondsSinceLastExecution', (new Date().getTime() - lastExecution) / 1000);
		}

		context.add(new VarTimestamp());

		context.add(new VarStreamTitle());
		context.add(new VarStreamGame());
		context.add(new VarStreamUptime());

		context.add(new VarFormatDate());
		context.add(new VarFormatTime());
		context.add(new VarFormatDateTime());
		context.add(new VarFormatSince());
		context.add(new VarFormatUntil());

		let globalVars = await GVar.getAll(undefined);
		for(let i = 0; i < globalVars.length; i++) {
			context.add(globalVars[i].asContextVar());
		}
		// TODO: add more enviorment variables

		return context;
	}

	private createListener(flow: Flow): (...args: any[]) => void {
		const self = this;
		return async (... args: any[]) => {
			let context = await self.createContext(flow, ...args);
			this.executionScheduler.schedule(flow, context, args);
		};
	}

	private async openContextMenu(event: Electron.IpcMainEvent, x: number, y: number, additionalVars: Array<{ name: string, type: 'number'|'string'|'boolean'|'array'|'object'|'file' }> = []) {
		let context = await this.createContext();

		let numbersMenu: Array<MenuItemConstructorOptions> = [];
		let stringsMenu: Array<MenuItemConstructorOptions> = [];
		let booleansMenu: Array<MenuItemConstructorOptions> = [];
		let listsMenu: Array<MenuItemConstructorOptions> = [];
		let assocsMenu: Array<MenuItemConstructorOptions> = [];

		let vars = context.iterable();
		for(let i = 0; i < vars.length; i++) {
			let t = vars[i].getType();
			if(t === 'number') {
				numbersMenu.push({ label: vars[i].name, click: this.sendContextMenuCommand });
			} else if(t === 'string') {
				stringsMenu.push({ label: vars[i].name, click: this.sendContextMenuCommand });
			} else if(t === 'boolean') {
				booleansMenu.push({ label: vars[i].name, click: this.sendContextMenuCommand });
			} else if(t === 'array') {
				listsMenu.push({ label: vars[i].name, click: this.sendContextMenuCommand });
			} else if(t === 'object') {
				assocsMenu.push({ label: vars[i].name, click: this.sendContextMenuCommand });
			}
		}

		for(let i = 0; i < additionalVars.length; i++) {
			if(additionalVars[i].type === 'string' || additionalVars[i].type === 'file') {
				stringsMenu.push({ label: additionalVars[i].name, click: this.sendContextMenuCommand });
			} else if(additionalVars[i].type === 'boolean') {
				booleansMenu.push({ label: additionalVars[i].name, click: this.sendContextMenuCommand });
			} else if(additionalVars[i].type === 'array') {
				listsMenu.push({ label: additionalVars[i].name, click: this.sendContextMenuCommand });
			} else if(additionalVars[i].type === 'object') {
				assocsMenu.push({ label: additionalVars[i].name, click: this.sendContextMenuCommand });
			} else {
				numbersMenu.push({ label: additionalVars[i].name, click: this.sendContextMenuCommand });
			}
		}

		let template: Array<MenuItemConstructorOptions> = [
			{ label: 'Variable selector', enabled: false },
			{ type: 'separator' }
		];

		if(numbersMenu.length > 0) template.push({ label: 'Numbers', submenu: numbersMenu });
		if(stringsMenu.length > 0) template.push({ label: 'Strings', submenu: stringsMenu });
		if(booleansMenu.length > 0) template.push({ label: 'Booleans', submenu: booleansMenu });
		if(listsMenu.length > 0) template.push({ label: 'Lists', submenu: listsMenu });
		if(assocsMenu.length > 0) template.push({ label: 'Assoc. arrays', submenu: assocsMenu });


		if(numbersMenu.length + stringsMenu.length + booleansMenu.length + listsMenu.length + assocsMenu.length > 0) {
			let menu = Menu.buildFromTemplate(template);
			menu.popup({ x, y, callback: () => {
				TTVST.mainWindow.ipcSend('app.ttvst.chatbot.contextSelect', '');
			} });
		}
	}

	private sendContextMenuCommand(item: MenuItem) {
		TTVST.mainWindow.ipcSend('app.ttvst.chatbot.contextSelect', item.label);
	}

	private async onGetContextForDynamicInput(event: Electron.IpcMainInvokeEvent, additionalVars: Array<{ name: string, type: 'number'|'string'|'boolean'|'array'|'object'|'file' }> = []) {
		let context = await this.createContext();

		let vars = context.iterable();
		let dynVars: Array<{ value: string, param: { label: string, description: string, type: string }}> = [];
		for(let i = 0; i < vars.length; i++) {
			let t: string = vars[i].getType();
			if(t === 'array') {
				t = 'list';
			} else if(t === 'object') {
				t = 'assoc';
			}

			dynVars.push({ value: '${' + vars[i].name + '}', param: { label: vars[i].name, description: vars[i].description, type: t } });
			if(t === 'string') {
				dynVars.push({ value: '${' + vars[i].name + '}', param: { label: vars[i].name, description: vars[i].description, type: 'file' } });
			}
		}

		for(let i = 0; i < additionalVars.length; i++) {
			if(additionalVars[i].type === 'string') {
				dynVars.push({ value: '${' + additionalVars[i].name + '}', param: { label: additionalVars[i].name, description: '', type: 'string' } });
				dynVars.push({ value: '${' + additionalVars[i].name + '}', param: { label: additionalVars[i].name, description: '', type: 'file' } });
			} else if(additionalVars[i].type === 'array') {
				dynVars.push({ value: '${' + additionalVars[i].name + '}', param: { label: additionalVars[i].name, description: '', type: 'list' } });
			} else if(additionalVars[i].type === 'object') {
				dynVars.push({ value: '${' + additionalVars[i].name + '}', param: { label: additionalVars[i].name, description: '', type: 'assoc' } });
			} else {
				dynVars.push({ value: '${' + additionalVars[i].name + '}', param: { label: additionalVars[i].name, description: '', type: additionalVars[i].type } });
			}
		}
		return dynVars;
	}

	private async onGetChannelPointRewards(event: Electron.IpcMainInvokeEvent) {
		if(TTVST.helix.userobj === null || typeof(TTVST.helix.userobj.id) !== 'string') {
			throw new Error('not logged in');
		}
		return await TTVST.helix.getCustomRewards();
	}

	private async onExportData(event: Electron.IpcMainInvokeEvent, data: string) {
		let saveFile = await dialog.showSaveDialog(TTVST.mainWindow.window, { filters: [{name: 'JSON', extensions: ['json']}]});
		if(!saveFile.canceled) {
			try {
				fs.writeFileSync(saveFile.filePath, data);
				return 1;
			} catch(e) {
				logger.error(e);
				return -1;
			}
		}
		return 0;
	}

	private async onImportData(event: Electron.IpcMainInvokeEvent): Promise<boolean|string> {
		let loadFile = await dialog.showOpenDialog(TTVST.mainWindow.window, { filters: [{name: 'JSON', extensions: ['json']}]});
		if(!loadFile.canceled) {
			try {
				let data = fs.readFileSync(loadFile.filePaths[0], { encoding: 'utf8' });
				return data;
			} catch(e) {
				logger.error(e);
				return false;
			}
		}
		return null;
	}

	private async onBackupData(event: Electron.IpcMainInvokeEvent, data: string) {
		let userData = app.getPath('userData');
		let chatbotFolder = Path.join(userData, 'chatbot');
		try {
			await fsPromise.access(chatbotFolder);
		} catch(e) {
			try {
				await fsPromise.mkdir(chatbotFolder);
			} catch(er) {
				logger.error(er);
				return;
			}
		}

		try {
			let folderFiles = await fsPromise.readdir(chatbotFolder);
			let backups: string[] = [];

			for(let i = 0; i < folderFiles.length; i++) {
				if(folderFiles[i].match(/^backup_[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/i)) {
					backups.push(folderFiles[i]);
				}
			}

			while(backups.length >= 30) {
				let rm = backups.shift();
				await fsPromise.unlink(Path.join(chatbotFolder, rm));
			}

			let now = new Date();
			await fsPromise.writeFile(Path.join(chatbotFolder, 'backup_' + now.getFullYear().toString() + '-' + (now.getMonth()+1).toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0') + '.json'), data);
		} catch(e) {
			logger.error(e);
		}
	}

	private async onGetDebug(event: Electron.IpcMainInvokeEvent, flow: number, step: string): Promise<FlowDebugData> {
		if(typeof(this.debugData[flow.toString()]) !== 'undefined') {
			let data = this.debugData[flow.toString()].getData(step);
			return data;
		}
		return { created: -1, step, data: {} };
	}

}
export = Chatbot;