import got from 'got';
import Context from '../Context/Context';

export interface IFlowWebRequest {
	discriminator: 'FlowWebRequest',
	url: string,
	method: 'HEAD'|'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS',
	contentType: string,
	headers: string,
	body: string,
	whattoresult: string,
	resultinto: string
}

class FlowWebRequest {

	data: IFlowWebRequest;

	constructor(data: IFlowWebRequest) {
		this.data = data;
	}
	async execute(context: Context) {
		if(this.data.url.toLowerCase().startsWith('http://') || this.data.url.toLowerCase().startsWith('https://')) {
			let options: {
				method: 'HEAD'|'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS',
				headers?: {[key: string]: string},
				body?: string,
				encoding: 'utf8'
			} = { method: 'GET', encoding: 'utf8' };

			options.method = this.data.method;

			if(['HEAD','GET','DELETE','OPTIONS'].indexOf(this.data.method) < 0 && this.data.contentType.length > 0) {
				options.headers = {};
				if(this.data.headers.length > 0) {
					let headersVar = context.get(this.data.headers);
					if(headersVar.type === 'object') {
						let headers = (await headersVar.getValue() as { [key: string]: string });
						let headkeys = Object.keys(headers);
						for(let i = 0; i < headkeys.length; i++) {
							options.headers[headkeys[i].toLowerCase()] = headers[headkeys[i]];
						}
					}
				}
				options.headers['content-type'] = this.data.contentType;
				options.body = await context.interpolate(this.data.body);
			}

			try {
				let response = await got(this.data.url, options);
				if(this.data.whattoresult.length > 0 && this.data.resultinto.length > 0) {
					let data = '';
					if(this.data.whattoresult === 'body') {
						data = response.body;
					} else {
						if(response.headers.hasOwnProperty(this.data.whattoresult.toLowerCase())) {
							let rh = response.headers[this.data.whattoresult];
							if(Array.isArray(rh)) {
								rh = rh[rh.length-1];
							}
							data = rh;
						}
					}

					await context.setValueOf(this.data.resultinto, data);
				}
			} catch(e){}
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowWebRequest;