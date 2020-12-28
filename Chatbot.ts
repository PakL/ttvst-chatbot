import { ipcMain } from 'electron';
import winston from 'winston';

import Flow from './lib/Flow';
import Folder from './lib/Folder';
import GVar from './lib/GVar';
import Context from './lib/Context/Context';
import VarInterface from './lib/Context/VarInterface';

import { IBroadcastArgument } from '../../dist/dev.pakl.ttvst/main/BroadcastMain';
import TTVSTMain from '../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;
declare var logger: winston.Logger;

class Chatbot {

	registering = false;
	redoRegistering = false;
	flows: Array<Flow> = [];
	broadcastListeners: { [channel: string]: Array<(...args: any[]) => void> } = {};
	lastExecution: { [flowkey: string]: number };

	constructor() {
		this.registerFlow = this.registerFlow.bind(this);

		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'Robot', status: 'error', title: 'Chatbot', info: 'Waiting for interface', buttons: [] });
		ipcMain.on('app.ttvst.chatbot.registerFlows', this.registerFlow);
	}

	private async registerFlow() {
		if(this.registering) {
			this.redoRegistering = true;
		}
		this.registering = true;

		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'Robot', status: 'warn', title: 'Chatbot', info: 'Registering flows', buttons: [] });

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
			}

			TTVST.BroadcastMain.instance.on('app.ttvst.chatbot.flow.' + f.key, listener);
			TTVST.BroadcastMain.registerAction({
				addon: 'chatbot',
				channel: 'app.ttvst.chatbot.flow.' + f.key,
				description: '',
				label: f.name,
				parameters
			});
		}
		
		TTVST.startpage.broadcastStatus({ key: 'app.ttvst.chatbot', icon: 'Robot', status: 'good', title: 'Chatbot', info: '{{flows}} active flows registered', infoValues: { flows: this.flows.length }, buttons: [{ icon: 'Refresh', action: 'app.ttvst.chatbot.registerFlows', title: 'Reregister' }] });

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

	private createContext(flow: Flow, ... args: any[]): Context {
		let context = new Context();
		if(flow.trigger.length > 0) {
			let argobj = TTVST.BroadcastMain.argumentsToObject(flow.trigger);
			for(let name of Object.keys(argobj)) {
				context.add(new VarInterface(name, argobj[name]));
			}
		}

		let lastExecution = 0;
		if(this.lastExecution.hasOwnProperty(flow.key.toString())) lastExecution = this.lastExecution[flow.key.toString()];

		context.add(new VarInterface('LastExecutionTime', lastExecution));
		context.add(new VarInterface('Timestamp', new Date().getTime()));
		context.add(new VarInterface('FlowName', flow.name));


		// TODO: add more enviorment variables

		return context;
	}

	private createListener(flow: Flow): (...args: any[]) => void {
		const self = this;
		return (... args: any[]) => {
			let context = self.createContext(flow, ...args);
			if(flow.conditionals.meets(context)) {
				flow.execute(context);
			}
		};
	}

}
export = Chatbot;