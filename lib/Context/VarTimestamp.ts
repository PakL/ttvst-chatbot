import VarInterface from './VarInterface';
import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;

class VarTimestamp extends VarInterface {

	constructor() {
		super('Timestamp', 0);
	}

	async setTo(): Promise<void> {}

	async getValue(): Promise<number> {
		return new Date().getTime();
	}

}
export = VarTimestamp;