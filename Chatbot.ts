import { ipcMain, Menu, MenuItem, MenuItemConstructorOptions } from 'electron';
import winston from 'winston';

import Flow from './lib/Flow';
import Folder from './lib/Folder';
import GVar from './lib/GVar';
import Context from './lib/Context/Context';
import VarInterface from './lib/Context/VarInterface';
import VarStreamTitle from './lib/Context/VarStreamTitle';
import VarStreamGame from './lib/Context/VarStreamGame';

import { IBroadcastArgument } from '../../dist/dev.pakl.ttvst/main/BroadcastMain';
import TTVSTMain from '../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;
declare var logger: winston.Logger;

class Chatbot {

	registering = false;
	redoRegistering = false;
	flows: Array<Flow> = [];
	broadcastListeners: { [channel: string]: Array<(...args: any[]) => void> } = {};
	lastExecution: { [flowkey: string]: number } = {};

	constructor() {
		this.registerFlow = this.registerFlow.bind(this);
		this.openContextMenu = this.openContextMenu.bind(this);
		this.onGetChannelPointRewards = this.onGetChannelPointRewards.bind(this);
		this.onGetContextForDynamicInput = this.onGetContextForDynamicInput.bind(this);

		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'ChatBot', status: 'error', title: 'Chatbot', info: 'Waiting for interface', buttons: [] });
		ipcMain.on('app.ttvst.chatbot.registerFlows', this.registerFlow);

		ipcMain.on('app.ttvst.chatbot.contextMenu', this.openContextMenu);
		ipcMain.handle('app.ttvst.chatbot.getChannelPointRewards', this.onGetChannelPointRewards);
		ipcMain.handle('app.ttvst.chatbot.getContextForDynamicInput', this.onGetContextForDynamicInput);
	}

	private async registerFlow() {
		if(this.registering) {
			this.redoRegistering = true;
		}
		this.registering = true;

		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'ChatBot', status: 'warn', title: 'Chatbot', info: 'Registering flows', buttons: [] });

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

		context.setValueOf('Timestamp', new Date().getTime());

		context.add(new VarStreamTitle());
		context.add(new VarStreamGame());

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

			let path = await flow.getAbsolutePath();
			for(let i = 0; i < path.length; i++) {
				if(!await path[i].conditionals.meets(context)) {
					return;
				}
			}
			
			if(await flow.conditionals.meets(context)) {
				this.lastExecution[flow.key.toString()] = new Date().getTime();
				flow.execute(context);
			}
		};
	}

	private async openContextMenu(event: Electron.IpcMainEvent, x: number, y: number, additionalVars: Array<{ name: string, type: 'number'|'string'|'boolean'|'array'|'object' }> = []) {
		let context = await this.createContext();

		for(let i = 0; i < additionalVars.length; i++) {
			let samplevalue: any = 0;
			if(additionalVars[i].type === 'string') {
				samplevalue = '';
			} else if(additionalVars[i].type === 'boolean') {
				samplevalue = false;
			} else if(additionalVars[i].type === 'array') {
				samplevalue = [];
			} else if(additionalVars[i].type === 'object') {
				samplevalue = {};
			}
			context.setValueOf(additionalVars[i].name, samplevalue);
		}

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

	private async onGetContextForDynamicInput(event: Electron.IpcMainInvokeEvent, additionalVars: Array<{ name: string, type: 'number'|'string'|'boolean'|'array'|'object' }> = []) {
		let context = await this.createContext();
		for(let i = 0; i < additionalVars.length; i++) {
			let samplevalue: any = 0;
			if(additionalVars[i].type === 'string') {
				samplevalue = '';
			} else if(additionalVars[i].type === 'boolean') {
				samplevalue = false;
			} else if(additionalVars[i].type === 'array') {
				samplevalue = [];
			} else if(additionalVars[i].type === 'object') {
				samplevalue = {};
			}
			context.setValueOf(additionalVars[i].name, samplevalue);
		}

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
		return dynVars;
	}

	private async onGetChannelPointRewards(event: Electron.IpcMainInvokeEvent) {
		if(TTVST.helix.userobj === null || typeof(TTVST.helix.userobj.id) !== 'string') {
			throw new Error('not logged in');
		}
		return await TTVST.helix.getCustomRewards();
	}

}
export = Chatbot;