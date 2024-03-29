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

	async execute(context: Context): Promise<{ [key: string]: any }> {
		if(this.data.time <= 0) {
			return;
		}
		const waittime = this.data.time;
		await new Promise<void>((res) => {
			setTimeout(() => {
				res();
			}, waittime);
		});
		return { timeout: waittime };
	}

	serialize() {
		return this.data;
	}

}
export default FlowWait;