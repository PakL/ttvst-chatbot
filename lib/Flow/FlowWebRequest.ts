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
	async execute(context: Context): Promise<{ [key: string]: any }> {
		let url = await context.interpolate(this.data.url);
		if(url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://')) {
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
				let response = await got(url, options);
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
					return { url: url, options, response: response.body, headers: response.headers, resultinto: this.data.resultinto, result: data };
				} else {
					await context.setValueOf(this.data.resultinto, '');
					return { url: url, options, response: response.body, headers: response.headers };
				}
			} catch(e){
				return { url: url, options, error: e.message };
			}
		} else {
			return { msg: 'Invalid URL' };
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowWebRequest;