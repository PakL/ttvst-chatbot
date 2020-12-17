import Context from '../Context/Context';

import FlowMath, { IFlowMath } from './FlowMath';
import FlowAction, { IFlowAction } from './FlowAction';
import FlowVariable, { IFlowVariable } from './FlowVariable';

import ConditionalGroup, { IConditionGroup } from '../ConditionalGroup';

export interface IFlowConditional {
	discriminator: 'FlowConditional',
	conditional: string,
	flow: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional>,
	elseflow: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional>,
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
			while(cond.meets(context) && (nowTime-startTime) < 60000) {
				await FlowConditional.execFlow(this.data.flow, context);
				nowTime = (new Date()).getTime();
			}
		} else {
			if(cond.meets(context)) {
				await FlowConditional.execFlow(this.data.flow, context);
			} else {
				await FlowConditional.execFlow(this.data.elseflow, context);
			}
		}
	}
	
	static async execFlow(f: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional>, context: Context) {
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