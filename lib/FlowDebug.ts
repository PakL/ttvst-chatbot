export interface FlowDebugData {
	created: number,
	step: string,
	data: {
		[key: string]: any
	}
}

class FlowDebug {
	
	debugdata: FlowDebugData[] = [];

	pushData(data: FlowDebugData) {
		for(let i = 0; i < this.debugdata.length; i++) {
			if(this.debugdata[i].step === data.step) {
				this.debugdata[i] = data;
				return;
			}
		}
		this.debugdata.push(data);
	}

	getData(step: string): FlowDebugData {
		for(let i = 0; i < this.debugdata.length; i++) {
			if(this.debugdata[i].step === step) {
				return this.debugdata[i];
			}
		}
		return { created: -1, step, data: {} };
	}

	clear() {
		this.debugdata = [];
	}

}

export default FlowDebug;