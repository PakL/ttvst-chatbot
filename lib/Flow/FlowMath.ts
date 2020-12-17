import mathjs from 'mathjs';
import Context from '../Context/Context';

export interface IFlowMath {
	discriminator: 'FlowMath',
	expression: string,
	resultinto: string
}

class FlowMath {

	data: IFlowMath;

	constructor(data: IFlowMath) {
		this.data = data;
	}

	async execute(context: Context) {
		let expr = await context.interpolate(this.data.expression);
		let result = mathjs.evaluate(expr);
		if(this.data.resultinto.length > 0 && (typeof(result) === 'number' || typeof(result) === 'string')) {
			context.setValueOf(this.data.resultinto, result);
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowMath;