import DBHelper from './DBHelper';

class IDBOrm {

	static store: string = '';
	static keyPath: string = '';
	
	static get(query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange): Promise<IDBOrm> {
		const self = this;
		return new Promise(async (resolve, reject) => {
			if(self.store.length > 0) {
				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(self.store, 'readonly');
				let objectStore = transaction.objectStore(self.store);
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

	static getByIndex(index: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange): Promise<IDBOrm[]> {
		const self = this;
		return new Promise(async (resolve, reject) => {
			if(self.store.length > 0) {
				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(self.store, 'readonly');
				let ind = transaction.objectStore(self.store).index(index);
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

	save(): Promise<this> {
		const orm = (this.constructor as typeof IDBOrm);
		return new Promise((async (resolve: (result: this) => void, reject: (reason: any) => void) => {
			if(orm.store.length > 0) {
				let db = await DBHelper.getDatabaseWhenReady();
				let transaction = db.transaction(orm.store, 'readwrite');
				let objectStore = transaction.objectStore(orm.store);
				let request: IDBRequest = null;
				if(typeof(this.data[orm.keyPath]) !== 'undefined') {
					request = objectStore.put(this.data);
				} else {
					request = objectStore.add(this.data);
				}
				request.onerror = function() {
					reject('DB request failed');
				}
				request.onsuccess = (() => {
					this.data[orm.keyPath] = request.result;
					resolve(this);
				}).bind(this);
			} else {
				return Promise.reject('ORM has no store name defined');
			}
		}).bind(this));
	}

}
export = IDBOrm;