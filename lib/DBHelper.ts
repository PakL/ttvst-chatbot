import { EventEmitter } from 'events';
import IDBOrm from './IDBOrm';

import TTVSTRenderer from '../../../dist/dev.pakl.ttvst/renderer/TTVST';
declare var TTVST: TTVSTRenderer;

const DBVERSION = 1;

class DBHelper extends EventEmitter {

	private static inst: DBHelper = null;
	static get instance(): DBHelper {
		if(DBHelper.inst === null) {
			DBHelper.inst = new DBHelper();
		}
		return DBHelper.inst;
	}

	private openRequest: IDBOpenDBRequest = null;
	private _ready: boolean = false;
	private database: IDBDatabase = null;
	private triggerWhenReady: ((res: IDBDatabase) => void)[] = [];

	private ormObjects: (typeof IDBOrm)[] = [];

	constructor() {
		super();

		this.onOpenRequestError = this.onOpenRequestError.bind(this);
		this.onOpenRequestSuccess = this.onOpenRequestSuccess.bind(this);
		this.onOpenRequestUpgradeneeded = this.onOpenRequestUpgradeneeded.bind(this);

		this.openRequest = indexedDB.open('chatbot', DBVERSION);
		this.openRequest.addEventListener('error', this.onOpenRequestError);
		this.openRequest.addEventListener('success', this.onOpenRequestSuccess);
		this.openRequest.addEventListener('upgradeneeded', this.onOpenRequestUpgradeneeded);
	}

	onOpenRequestError() {
		TTVST.ui.alert('The database for chatbot settings could not be opened. This error will lead to the chatbot not working. We recommend to restart the TTVStreamerTool. If the issue persist please seek help in the TTVST Discord or via e-mail. You can find all information on ttvst.app', 'Critical database error', 'ErrorBadge');
	}

	onOpenRequestSuccess() {
		this._ready = true;
		this.database = this.openRequest.result;

		for(let i = 0; i < this.triggerWhenReady.length; i++) {
			this.triggerWhenReady[i](this.database);
		}
	}

	onOpenRequestUpgradeneeded(event: IDBVersionChangeEvent) {
		for(let i = 0; i < this.ormObjects.length; i++) {
			this.ormObjects[i].onOpenRequestUpgradeneeded(event);
		}

			/*let commandStore = db.createObjectStore('commands', { autoIncrement: true });
			commandStore.createIndex('path', 'path', { unique: false });
			commandStore.createIndex('name', 'name', { unique: false });
			commandStore.createIndex('trigger', 'trigger', { unique: false });
			commandStore.createIndex('lastModified', 'lastModified', { unique: false });*/

	}

	addORMObject(orm: typeof IDBOrm) {
		this.ormObjects.push(orm);
	}

	get ready(): boolean {
		return (this._ready && this.database !== null);
	}

	getDatabaseWhenReady(): Promise<IDBDatabase> {
		const self = this;
		return new Promise((resolve, reject) => {
			if(self.ready) {
				resolve(self.database);
			} else {
				self.triggerWhenReady.push(resolve);
			}
		});
	}

}

export = DBHelper.instance;