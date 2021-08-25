import Context from '../Context/Context';

import FlowMath, { IFlowMath } from './FlowMath';
import FlowAction, { IFlowAction } from './FlowAction';
import FlowVariable, { IFlowVariable } from './FlowVariable';
import FlowWait, { IFlowWait } from './FlowWait';
import FlowWebRequest, { IFlowWebRequest } from './FlowWebRequest';

import ConditionalGroup, { IConditionGroup } from '../ConditionalGroup';


export interface IFlowConditional {
	discriminator: 'FlowConditional',
	conditional: string,
	flow: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest>,
	elseflow: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest>,
	loop: boolean
}

class FlowConditional {

	data: IFlowConditional;
	stepPrefix: string;

	constructor(data: IFlowConditional, stepPrefix: string = '') {
		this.data = data;
		this.stepPrefix = stepPrefix;
	}

	async execute(context: Context): Promise<{ [key: string]: any }> {
		let condJ: IConditionGroup = JSON.parse(this.data.conditional);
		let cond = new ConditionalGroup(condJ);
		
		if(this.data.loop) {
			let startTime = (new Date()).getTime();
			let nowTime = (new Date()).getTime();
			// Check for any conditions, or we get stuck in an "endless" loop
			if(cond.conditions.length > 0) {
				let i = 0;
				while(await cond.meets(context) && (nowTime-startTime) < 60000) {
					await FlowConditional.execFlow(this.data.flow, context, this.stepPrefix);
					nowTime = (new Date()).getTime();
					i++;
				}

				return { conditions: await cond.debug(context), loopruns: i };
			} else {
				return { conditions: {}, loopruns: 0 };
			}
		} else {
			if(await cond.meets(context)) {
				let debugData = JSON.parse(JSON.stringify({ conditions: await cond.debug(context), results: true }));
				await FlowConditional.execFlow(this.data.flow, context, this.stepPrefix);
				return debugData;
			} else {
				let debugData = JSON.parse(JSON.stringify({ conditions: await cond.debug(context), results: false }));
				await FlowConditional.execFlow(this.data.elseflow, context, this.stepPrefix + '_alt');
				return debugData;
			}
		}
	}
	
	static async execFlow(f: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest>, context: Context, stepPrefix: string = '') {
		for(let i = 0; i < f.length; i++) {
			let fl = null;
			switch(f[i].discriminator) {
				case 'FlowConditional':
					fl = new FlowConditional(f[i] as IFlowConditional, stepPrefix + '_' + i.toString());
					break;
				case 'FlowMath':
					fl = new FlowMath(f[i] as IFlowMath);
					break;
				case 'FlowAction':
					fl = new FlowAction(f[i] as IFlowAction);
					break;
				case 'FlowVariable':
					fl = new FlowVariable(f[i] as IFlowVariable);
					break;
				case 'FlowWait':
					fl = new FlowWait(f[i] as IFlowWait);
					break;
				case 'FlowWebRequest':
					fl = new FlowWebRequest(f[i] as IFlowWebRequest);
					break;
			}

			if(fl !== null) {
				let debug = await fl.execute(context);
				context.pushDebug(stepPrefix + '_' + i.toString(), JSON.parse(JSON.stringify(debug)));
			}
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowConditional;