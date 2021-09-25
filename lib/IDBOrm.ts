import DBHelper from './DBHelper';

import { ipcRenderer, ipcMain } from 'electron';

import TTVSTMain from '../../../dist/dev.pakl.ttvst/main/TTVSTMain';
declare var TTVST: TTVSTMain;

if(typeof(ipcRenderer) !== 'undefined') {
	ipcRenderer.on('app.ttvst.chatbot.idborm.get', async (event, ipcKey: string, store: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange) => {
		let orm = null;
		try {
			orm = (await IDBOrm.get(query, store)).data;
		} catch(e) {}
		ipcRenderer.send('app.ttvst.chatbot.idborm.get.' + ipcKey, orm);
	});
	ipcRenderer.on('app.ttvst.chatbot.idborm.getAll', async (event, ipcKey: string, store: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange) => {
		let orm = [];
		try {
			let ormtemp = await IDBOrm.getAll(query, store);
			for(let i = 0; i < ormtemp.length; i++) {
				orm.push(ormtemp[i].data);
			}
		} catch(e) {
			orm = null;
		}
		ipcRenderer.send('app.ttvst.chatbot.idborm.getAll.' + ipcKey, orm);
	});
	ipcRenderer.on('app.ttvst.chatbot.idborm.getIndex', async (event, ipcKey: string, store: string, index: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange) => {
		let orm = [];
		try {
			let ormtemp = await IDBOrm.getByIndex(index, query, store);
			for(let i = 0; i < ormtemp.length; i++) {
				orm.push(ormtemp[i].data);
			}
		} catch(e) {
			orm = null;
		}
		ipcRenderer.send('app.ttvst.chatbot.idborm.getIndex.' + ipcKey, orm);
	});
	ipcRenderer.on('app.ttvst.chatbot.idborm.save', async (event, ipcKey: string, store: string, keyPath: string, data: any) => {
		let orm = new IDBOrm(data);
		try {
			await orm.save(store, keyPath);
			ipcRenderer.send('app.ttvst.chatbot.idborm.save.' + ipcKey, true);
		} catch(e) {
			ipcRenderer.send('app.ttvst.chatbot.idborm.save.' + ipcKey, false);
		}
	});
	ipcRenderer.on('app.ttvst.chatbot.idborm.delete', async (event, ipcKey: string, store: string, keyPath: string, data: any) => {
		let orm = new IDBOrm(data);
		try {
			await orm.delete(store, keyPath);
			ipcRenderer.send('app.ttvst.chatbot.idborm.delete.' + ipcKey, true);
		} catch(e) {
			ipcRenderer.send('app.ttvst.chatbot.idborm.delete.' + ipcKey, false);
		}
	});
}

class IDBOrm {

	static store: string = '';
	static keyPath: string = '';
	
	static get(query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange, store: string = null): Promise<IDBOrm> {
		const self = this;
		if(store === null) {
			store = self.store
		}
		return new Promise(async (resolve, reject) => {
			if(store.length > 0) {
				if(typeof(ipcMain) !== 'undefined') {
					let ipcKey = ((new Date()).getTime() + Math.random()).toString(16);
					ipcMain.once('app.ttvst.chatbot.idborm.get.' + ipcKey, (event, orm) => {
						if(orm !== null) {
							resolve(new self(orm));
						} else {
							reject('DB request failed');
						}
					});
					TTVST.mainWindow.ipcSend('app.ttvst.chatbot.idborm.get', ipcKey, store, query);
					return;
				}

				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(store, 'readonly');
				let objectStore = transaction.objectStore(store);
				let request = objectStore.get(query);
				request.onerror = function() {
					reject('DB request failed');
				}
				request.onsuccess = function() {
					resolve(new self(request.result));
				}
			} else {
				return Promise.reject('ORM has no store name defined');
			}
		});
	}
	
	static getAll(query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange, store: string = null): Promise<IDBOrm[]> {
		const self = this;
		if(store === null) {
			store = self.store
		}
		return new Promise(async (resolve, reject) => {
			if(store.length > 0) {
				if(typeof(ipcMain) !== 'undefined') {
					let ipcKey = ((new Date()).getTime() + Math.random()).toString(16);
					ipcMain.once('app.ttvst.chatbot.idborm.getAll.' + ipcKey, (event, orm) => {
						let list = [];
						if(orm !== null) {
							for(let i = 0; i < orm.length; i++) {
								list.push(new self(orm[i]));
							}
							resolve(list);
						} else {
							reject('DB request failed');
						}
					});
					TTVST.mainWindow.ipcSend('app.ttvst.chatbot.idborm.getAll', ipcKey, store, query);
					return;
				}

				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(store, 'readonly');
				let objectStore = transaction.objectStore(store);
				let request = objectStore.getAll(query);
				request.onerror = function() {
					reject('DB request failed');
				}
				request.onsuccess = function() {
					let cursor = request.result;
					let result: IDBOrm[] = [];
					for(let i = 0; i < cursor.length; i++) {
						result.push(new self(cursor[i]));
					}
					resolve(result);
				}
			} else {
				return Promise.reject('ORM has no store name defined');
			}
		});
	}

	static getByIndex(index: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange, store: string = null): Promise<IDBOrm[]> {
		const self = this;
		if(store === null) {
			store = self.store
		}
		return new Promise(async (resolve, reject) => {
			if(store.length > 0) {
				if(typeof(ipcMain) !== 'undefined') {
					let ipcKey = ((new Date()).getTime() + Math.random()).toString(16);
					ipcMain.once('app.ttvst.chatbot.idborm.getIndex.' + ipcKey, (event, orm) => {
						let list = [];
						if(orm !== null) {
							for(let i = 0; i < orm.length; i++) {
								list.push(new self(orm[i]));
							}
							resolve(list);
						} else {
							reject('DB request failed');
						}
					});
					TTVST.mainWindow.ipcSend('app.ttvst.chatbot.idborm.getIndex', ipcKey, store, index, query);
					return;
				}

				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(store, 'readonly');
				let ind = transaction.objectStore(store).index(index);
				let request = ind.openCursor(query)
				request.onerror = function() {
					reject('DB request failed');
				}
				let result: IDBOrm[] = [];
				request.onsuccess = function() {
					let cursor = request.result;
					if(cursor) {
						result.push(new self(cursor.value));
						cursor.continue();
					} else {
						resolve(result);
					}
				}
			} else {
				return Promise.reject('ORM has no store name defined');
			}
		});
	}

	static factory(data: any): IDBOrm { return null; }

	static onOpenRequestUpgradeneeded(event: IDBVersionChangeEvent) {}

	data: any = null;

	constructor(data: any) {
		this.data = data;
	}

	save(store: string = null, keyPath: string = null): Promise<this> {
		const orm = (this.constructor as typeof IDBOrm);

		if(store === null || keyPath === null) {
			store = orm.store;
			keyPath = orm.keyPath;
		}
		return new Promise((async (resolve: (result: this) => void, reject: (reason: any) => void) => {
			if(store.length > 0 && keyPath.length > 0) {
				if(typeof(ipcMain) !== 'undefined') {
					let ipcKey = ((new Date()).getTime() + Math.random()).toString(16);
					ipcMain.once('app.ttvst.chatbot.idborm.save.' + ipcKey, ((event: Electron.IpcMainEvent, result: boolean) => {
						if(result) {
							resolve(this);
						} else {
							reject('DB request failed');
						}
					}).bind(this));
					TTVST.mainWindow.ipcSend('app.ttvst.chatbot.idborm.save', ipcKey, store, keyPath, this.data);
					return;
				}

				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(store, 'readwrite');
				let objectStore = transaction.objectStore(store);
				let request: IDBRequest = null;
				if(typeof(this.data[keyPath]) !== 'undefined') {
					request = objectStore.put(this.data);
				} else {
					request = objectStore.add(this.data);
				}
				request.onerror = function() {
					reject('DB request failed');
				}
				request.onsuccess = (() => {
					this.data[keyPath] = request.result;
					resolve(this);
				}).bind(this);
			} else {
				reject('ORM has no store name defined');
			}
		}).bind(this));
	}

	delete(store: string = null, keyPath: string = null): Promise<void> {
		const orm = (this.constructor as typeof IDBOrm);

		if(store === null || keyPath === null) {
			store = orm.store;
			keyPath = orm.keyPath;
		}
		return new Promise((async (resolve: () => void, reject: (reason: any) => void) => {
			if(store.length > 0 && keyPath.length > 0) {
				if(typeof(ipcMain) !== 'undefined') {
					let ipcKey = ((new Date()).getTime() + Math.random()).toString(16);
					ipcMain.once('app.ttvst.chatbot.idborm.delete.' + ipcKey, ((event: Electron.IpcMainEvent, result: boolean) => {
						if(result) {
							resolve();
						} else {
							reject('DB request failed');
						}
					}).bind(this));
					TTVST.mainWindow.ipcSend('app.ttvst.chatbot.idborm.delete', ipcKey, store, keyPath, this.data);
					return;
				}

				if(typeof(this.data[keyPath]) !== 'undefined') {
					let db = await DBHelper.getDatabaseWhenReady();
					let transaction = db.transaction(store, 'readwrite');
					let objectStore = transaction.objectStore(store);
					let request = objectStore.delete(this.data[keyPath]);
					request.onerror = function() {
						reject('DB request failed');
					}
					request.onsuccess = (() => {
						delete this.data[keyPath];
						resolve();
					}).bind(this);
				} else {
					reject('Object not in store yet');
				}
			} else {
				reject('ORM has no store name defined');
			}
		}).bind(this));
	}

}
export = IDBOrm;