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

	constructor(data: IFlowConditional) {
		this.data = data;
	}

	async execute(context: Context) {
		let condJ: IConditionGroup = JSON.parse(this.data.conditional);
		let cond = new ConditionalGroup(condJ);
		
		if(this.data.loop) {
			let startTime = (new Date()).getTime();
			let nowTime = (new Date()).getTime();
			// Check for any conditions, or we get stuck in an "endless" loop
			if(cond.conditions.length > 0) {
				while(await cond.meets(context) && (nowTime-startTime) < 60000) {
					await FlowConditional.execFlow(this.data.flow, context);
					nowTime = (new Date()).getTime();
				}
			}
		} else {
			if(await cond.meets(context)) {
				await FlowConditional.execFlow(this.data.flow, context);
			} else {
				await FlowConditional.execFlow(this.data.elseflow, context);
			}
		}
	}
	
	static async execFlow(f: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest>, context: Context) {
		for(let i = 0; i < f.length; i++) {
			let fl = null;
			switch(f[i].discriminator) {
				case 'FlowConditional':
					fl = new FlowConditional(f[i] as IFlowConditional);
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
				await fl.execute(context);
			}
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowConditional;