import winston from 'winston';

import Chatbot from '../Chatbot';
import Context from "./Context/Context";
import Flow from "./Flow";
import TTVSTMain from '../../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;
declare var logger: winston.Logger;

class ExecutionScheduler {

	private chatbot: Chatbot;
	private running: boolean = false;
	private queue: Array<{ flow: Flow, context: Context, args: any[] }> = [];

	constructor(chatbot: Chatbot) {
		this.chatbot = chatbot;
	}

	schedule(flow: Flow, context: Context, args: any[]) {
		this.queue.push({ flow, context, args });
		this.run();
	}

	private execute(flow: Flow, context: Context, args: any[]): Promise<void> {
		return new Promise(async (resolve) => {
			let resolved = false;
			let finish = () => {
				if(!resolved) {
					resolved = true;
					resolve();
				}
			}

			// Check conditions of folders above
			let path = await flow.getAbsolutePath();
			for(let i = 0; i < path.length; i++) {
				if(!await path[i].conditionals.meets(context)) {
					finish();
					return;
				}
			}
			
			if(await flow.conditionals.meets(context)) {
				// Save debug information about execution conditions
				let condDebug = await flow.conditionals.debug(context);
				let argobj: any = args;
				if(TTVST.BroadcastMain.getTrigger({ channel: flow.trigger }).length > 0) {
					argobj = TTVST.BroadcastMain.argumentsToObject(flow.trigger, ...args);
				}
				context.pushDebug('_-1', JSON.parse(JSON.stringify({ conditionals: condDebug, trigger: flow.trigger, args: argobj })));

				// Execute and wait 100ms at most to execute the next command
				this.chatbot.lastExecution[flow.key.toString()] = new Date().getTime();
				flow.execute(context).catch((err) => { logger.error(err) }).finally(finish);
				setTimeout(finish, 100);
			} else {
				finish();
			}
		});
	}

	private async run() {
		if(this.running) return;
		this.running = true;

		while(this.queue.length > 0) {
			let r = this.queue.shift();
			await this.execute(r.flow, r.context, r.args);
		}
		this.running = false;
	}

}

export = ExecutionScheduler;