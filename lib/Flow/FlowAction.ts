import Context from '../Context/Context';

import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';
declare var TTVST: TTVSTMain;

export interface IFlowAction {
	discriminator: 'FlowAction',
	channel: string,
	parameters: Array<string|number>,
	resultinto: string
}

class FlowAction {

	data: IFlowAction;

	constructor(data: IFlowAction) {
		this.data = data;
	}

	async execute(context: Context) {
		let parameters: Array<string|number> = [];
		for(let i = 0; i < this.data.parameters.length; i++) {
			if(typeof(this.data.parameters[i]) === 'string') {
				parameters.push(await context.interpolate(this.data.parameters[i] as string));
			} else {
				parameters.push(this.data.parameters[i]);
			}
		}
		let result = await TTVST.BroadcastMain.instance.execute(this.data.channel, ...parameters);
		if(this.data.resultinto.length > 0 && typeof(result) !== 'undefined') {
			context.setValueOf(this.data.resultinto, result);
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowAction;