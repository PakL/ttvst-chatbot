import VarInterface from './VarInterface';
import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;

class VarStreamUptime extends VarInterface {

	constructor() {
		super('StreamUptime', 0);
	}

	async setTo(): Promise<void> {}

	async getValue(): Promise<number> {
		try {
			let startedAt = (await TTVST.ttvbroadcast.getStreamAPIProperty('', 'started_at') as string);
			let startedAtDate = new Date(startedAt);
			return startedAtDate.getTime();
		} catch(e) {}
		return 0;
	}

}
export = VarStreamUptime;