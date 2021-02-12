import Context from '../Context/Context';

export interface IFlowWait {
	discriminator: 'FlowWait',
	time: number
}

class FlowWait {

	data: IFlowWait;

	constructor(data: IFlowWait) {
		this.data = data;
	}

	async execute(context: Context) {
		if(this.data.time <= 0) {
			return;
		}
		const waittime = this.data.time;
		await new Promise<void>((res) => {
			setTimeout(() => {
				res();
			}, waittime);
		});
	}

	serialize() {
		return this.data;
	}

}
export default FlowWait;