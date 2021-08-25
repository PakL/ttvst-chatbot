import * as mathjs from 'mathjs';
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

	async execute(context: Context): Promise<{ [key: string]: any }> {
		let expr = await context.interpolate(this.data.expression);
		let result = mathjs.evaluate(expr);
		if(this.data.resultinto.length > 0) {
			if((typeof(result) === 'number' || typeof(result) === 'string')) {
				await context.setValueOf(this.data.resultinto, result);
				return { math: expr, result, resultinto: this.data.resultinto };
			} else if(typeof(result) === 'object' && result.hasOwnProperty('entries')) {
				let v = result.entries;
				if(v.length > 0) {
					await context.setValueOf(this.data.resultinto, v[v.length-1]);
					return { math: expr, result: v[v.length-1], resultinto: this.data.resultinto };
				}
			}
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowMath;