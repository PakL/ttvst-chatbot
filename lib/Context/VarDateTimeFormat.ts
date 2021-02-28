import VarInterface from './VarInterface';
import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';

const masks: {date: { [lang: string]: string }, time: { [lang: string]: string }} = {
	date: {
		de: "dd.mm.yyyy",
		en: "mm/dd/yyyy"
	},
	time: {
		de: "HH:MM:ss",
		en: "hh:MM:ss TT"
	}
}

declare var TTVST: TTVSTMain;

export class VarFormatDate extends VarInterface {

	constructor() {
		super('FormatDate', '');
	}

	async getValue(index?: string|number): Promise<string> {
		let date = new Date();
		if(typeof(index) === 'string' || typeof(index) === 'number') {
			date = new Date(index);
		}

		let mask = masks.date[await TTVST.Settings.language()];
		const dateFormat = await TTVST.DateFormat();
		return dateFormat(date, mask);
	}

}

export class VarFormatTime extends VarInterface {

	constructor() {
		super('FormatTime', '');
	}

	async getValue(index?: string|number): Promise<string> {
		let date = new Date();
		if(typeof(index) === 'string' || typeof(index) === 'number') {
			date = new Date(index);
		}

		let mask = masks.time[await TTVST.Settings.language()];
		const dateFormat = await TTVST.DateFormat();
		return dateFormat(date, mask, date.getTime() < (356 * 24 * 60 * 60 * 1000));
	}

}

export class VarFormatDateTime extends VarInterface {

	constructor() {
		super('FormatDateTime', '');
	}

	async getValue(index?: string|number): Promise<string> {
		let date = new Date();
		if(typeof(index) === 'string' || typeof(index) === 'number') {
			date = new Date(index);
		}

		let mask = masks.date[await TTVST.Settings.language()] + ' ' + masks.time[await TTVST.Settings.language()];
		const dateFormat = await TTVST.DateFormat();
		return dateFormat(date, mask);
	}

}

export class VarFormatSince extends VarInterface {

	constructor() {
		super('FormatSince', '');
	}

	timeDiff(da: Date, db: Date): string {
		let diff = Math.round((da.getTime() - db.getTime()) / 1000);
		let indexIsAfter = false;
		if(diff < 0) {
			indexIsAfter = true;
			diff *= -1;
		}

		let hours = Math.floor(diff / 60 / 60);
		diff = diff - (hours * 60 * 60);
		let minutes = Math.floor(diff / 60);
		let seconds = diff - (minutes * 60);

		return (indexIsAfter ? '-' : '') + (hours > 0 ? hours.toString() + ':' : '') + (minutes < 10 && hours > 0 ? '0' : '') + minutes.toString() + ':' + (seconds < 10 ? '0' : '') + seconds.toString();
	}

	async getValue(index?: string|number): Promise<string> {
		let date = new Date();
		if(typeof(index) === 'string' || typeof(index) === 'number') {
			date = new Date(index);
		}
		
		let now = new Date();
		return this.timeDiff(now, date);
	}

}

export class VarFormatUntil extends VarFormatSince {

	get name() { return 'FormatUntil'; }

	async getValue(index?: string|number): Promise<string> {
		let date = new Date();
		if(typeof(index) === 'string' || typeof(index) === 'number') {
			date = new Date(index);
		}
		
		let now = new Date();
		return this.timeDiff(date, now);
	}

}