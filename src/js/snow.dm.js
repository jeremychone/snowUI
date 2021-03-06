var snow = snow || {};

/**
 * @namespace snow.dm data manager layers to register, access DAOs.
 * DAOs are javascript objects that must implement the following CRUD methods get, list, create, update, remove, and the getIdName method.<br /> 
 * Signatures of these methods should match the corresponding snow.dm.** methods.<br />
 * <br />
 * Note that DAO CRUD methods can return directly the result or a deferred object. Also, it is important to note that snow.dm.*** CRUD access methods
 * will always return deferred object (either the DAO return deferred, or a wrapped deferred if the DAO method did not return a deferred)<br />
 * <br />
 * The deferred pattern for daos allows the application to be agnostic about the call mode, synchronous or asynchronous (e.g. Ajax, Workers, and other callback based called), 
 * and consequently offer the maximum flexibility during development and production. It also enforce a good practice on how to build the UI components.<br />
 * <br />
 * If there is a need to access the daos result directly, the snow.sdm ("straight dm") can be used.  
 */
snow.dm = {};

(function($) {

	var daoDic = {};

	//changeEventListenersby objectType
	var daoChangeEventListeners = {};

	function getDao(objectType) {
		var dao = daoDic[objectType];
		if (dao) {
			return dao;
		} else {
			var er = "Cannot find the DAO for objectType: " + objectType;
			snow.log.error(er);
			throw er;
		}
	};

	/**
	 * Register a DAO for a given object type.
	 * @param {String} objectType the object type that this dao will represent
	 * @param {DAO Oject} a Dao instance that implement the crud methods: get, find, create, update, remove.
	 */
	snow.dm.registerDao = function(objectType, dao) {
		daoDic[objectType] = dao;
		return this;
	};

	/**
	 * Add a change listener function for an objectType. <br />
	 * Change listener get triggered on create, update, and remove.
	 * @param {String} objectType
	 * @param {Function} listener
	 */
	snow.dm.addChangeListener = function(objectType, listener) {
		var listeners = daoChangeEventListeners[objectType];
		if (!listeners) {
			listeners = [];
			daoChangeEventListeners[objectType] = listeners;
		}
		daoChangeEventListeners[objectType] = listeners;
		listeners.push(listener);

		return this;
	};

	/**
	 * Return the id property name (this is the only method in snow.ddm that is not deferred)
	 */
	snow.dm.getIdName = function(objectType) {
		return snow.sdm.getIdName(objectType);
	}

	/**
	 * Wrap the snow.dm.get(objectType,id) with a deferred result
	 */
	snow.dm.get = function(objectType, id) {
		return wrapWithDeferred(snow.sdm.get(objectType, id));
	}

	/**
	 * Wrap the snow.dm.list(objectType,opts) with a deferred result
	 */
	snow.dm.list = function(objectType, opts) {
		return wrapWithDeferred(snow.sdm.list(objectType, opts));
	}

	/**
	 * Wrap the snow.dm.create(objectType,data) with a deferred result
	 */
	snow.dm.create = function(objectType, data) {
		return wrapWithDeferred(snow.sdm.create(objectType, data));
	}

	/**
	 * Wrap the snow.dm.update(objectType,id,data) with a deferred result
	 */
	snow.dm.update = function(objectType, id, data) {
		return wrapWithDeferred(snow.sdm.update(objectType, id, data));
	}

	/**
	 * Wrap the snow.dm.remove(objectType,id) with a deferred result
	 */
	snow.dm.remove = function(objectType, id) {
		return wrapWithDeferred(snow.sdm.remove(objectType, id));
	}

	// ------- snow.sdm DAO API ------ //
	/**
	 * @namespace snow.sdm Straight Data Manager API that just return what the DAO returns (it does not Deferred wrap). This is mostly used by the snow.dm, but
	 * could be used by the application when it is ok to have blocking data calls (i.e. local data) or to expose the async/sync to the application layer.
	 */
	snow.sdm = {};

	/**
	 * DAO Interface: Return the property ID name
	 * @param {string} the objectType
	 * @return the id (this is not deferred)
	 * @throws error if dao cannot be found
	 */
	snow.sdm.getIdName = function(objectType) {
		return getDao(objectType).getIdName(objectType);
	}

	/**
	 * DAO Interface: Return a value or deferred object (depending of DAO impl) for this objectType and id.
	 * @param {Object} objectType
	 * @param {Object} id
	 * @return
	 */
	snow.sdm.get = function(objectType, id) {
		return getDao(objectType).get(objectType, id);
	};

	/**
	 * DAO Interface: Return an array of values or a deferred object (depending of DAO impl) for this objectType and options
	 * @param {Object} objectType
	 * @param {Object} opts (not supported yet)
	 *           opts.pageIndex {Number} Index of the page, starting at 0.
	 *           opts.pageSize  {Number} Size of the page
	 *           opts.match     {Object}
	 *           opts.orderBy   {String}
	 *           opts.orderType {String} "asc" or "desc"
	 */
	snow.sdm.list = function(objectType, opts) {
		return getDao(objectType).list(objectType, opts);
	};

	/**
	 * DAO Interface: Create a new instance of the object for a give objectType and data. <br />
	 *
	 * The DAO should return or resolve with the newly created data.
	 *
	 * @param {Object} objectType
	 * @param {Object} data
	 */
	snow.sdm.create = function(objectType, data) {
		var result = getDao(objectType).create(objectType, data);

		// if the result is a deferred object, then, wait until done to callChangeListeners
		if (result && $.isFunction(result.promise)) {
			result.done( function(newData) {
				callChangeListeners(objectType, "create", null, newData, data);
			});

		} else {
			callChangeListeners(objectType, "create", null, result, data);

		}
		return result;

	};

	/**
	 * DAO Interface: update a existing id with a set of property/value data.
	 *
	 */
	snow.sdm.update = function(objectType, id, data) {
		var result = getDao(objectType).update(objectType,id, data);

		// if the result is a deferred object, then, wait until done to callChangeListeners
		if (result && $.isFunction(result.promise)) {
			result.done( function(newData) {
				callChangeListeners(objectType, "update", null, newData, data);
			});

		} else {
			callChangeListeners(objectType, "update", null, result, data);

		}
		return result;

	};

	/**
	 * DAO Interface: remove an entity for a given type and id.
	 *
	 */
	snow.sdm.remove = function(objectType, id) {
		var result = getDao(objectType).remove(objectType, id);

		// if the result is a deferred object, then, wait until done to callChangeListeners
		if (result && $.isFunction(result.promise)) {
			result.done( function(removedObject) {
				callChangeListeners(objectType, "remove", removedObject, null, null);
			});

		} else {
			callChangeListeners(objectType, "remove", result, null, null);
		}

	};

	// ------- /snow.sdm DAO API ------ //


	/**
	 * Private method to trigger the change(daoEvent) on all listeners.
	 * NOTE: this param names maps to what is daoChangeEvent
	 *
	 * @param {Object} objectType
	 * @param {Object} action ("remove" "create" "update")
	 * @param {Object} newData The data after the change (null if remove)
	 * @param {Object} saveData The data object that was used to do the create/update. Could be partial object.
	 */
	function callChangeListeners(objectType, action, newData, saveData) {
		var listeners = daoChangeEventListeners[objectType], listener;

		var daoChangeEvent = {
			objectType: objectType,
			action: action,
			newData: newData,
			saveData: saveData
		};

		if (listeners) {
			for (var i = 0; i < listeners.length; i++) {
				listeners[i](daoChangeEvent);
			}
		}
	};

	/**
	 * Wrap with a deferred object if the obj is not a deferred itself.
	 */
	function wrapWithDeferred(obj) {
		//if it is a deferred, then, trust it, return it.
		if (obj && $.isFunction(obj.promise)) {
			return obj;
		} else {
			var dfd = $.Deferred();
			dfd.resolve(obj);
			return dfd;
		}
	}

})(jQuery);

// ------ Simple DAO ------ //
/**
 * @namespace Some default convenient DAOs (for now, only development DAOs)
 */
snow.dao = {};

(function($) {

	function SimpleDao(store) {
		this.init(store);
	}

	SimpleDao.prototype.init = function(store) {
		this._store = store || [];
		return this;
	}

	// ------ DAO Interface Implementation ------ //
	SimpleDao.prototype.getIdName = function(objectType) {
		return "id";
	}

	SimpleDao.prototype.get = function(objectType, id) {
		var idx = snow.util.array.getIndex(this._store, "id", id);
		return this._store[idx];
	}

	//for now, just support opts.orderBy
	SimpleDao.prototype.list = function(objectType, opts) {
		//TODO: probably need to copy the array to avoid giving the original array
		var resultSet = this._store;

		if (opts) {
			if (opts.orderBy) {
				resultSet = snow.util.array.sortBy(resultSet, opts.orderBy)
			}
			if (opts.match) {
				resultSet = $.map(resultSet, function(val, idx) {
					var pass = true;

					$.each(opts.match, function(k, v) {
						if (val[k] === v) {
							pass = pass && true;
						} else {
							pass = false;
						}
					});

					return (pass) ? val : null;
				});

			}
		}
		return resultSet;
	}

	SimpleDao.prototype.create = function(objectType, data) {
		var idName = snow.dm.getIdName(objectType);

		// if the id has already been created, no biggies, otherwise, create it.
		if (typeof data[idName] !== "undefined") {
			var er = "SimpleDao.create error: Id present in data object. Cannot create. You might want to call update instead.";
			snow.log.debug(er);
			throw er;

		}

		data[idName] = snow.util.uuid(12);

		this._store.push(data);

		return data;
	}

	SimpleDao.prototype.update = function(objectType, id, data) {
		// if there is an id, make sure it matches
		var idName = snow.dm.getIdName(objectType);
		var dataId = data[idName];
		if (typeof dataId !== "undefined" && dataId != id) {
			var er = "SimpleDao.update error: Id in param and data does not match. Cannot update data.";
			snow.log.debug(er);
			throw er;
		}

		// remove the id from the data to be saved, not needed.
		delete data[idName];

		//get the data, and populate the new value
		var storeData = this.get(objectType, id);
		if (storeData) {
			$.extend(storeData, data);
			return storeData;
		}
	}

	SimpleDao.prototype.remove = function(objectType, id) {
		var oldData = this.get(objectType, id);
		var idx = snow.util.array.getIndex(this._store, "id", id);
		if (idx > -1) {
			snow.util.array.remove(this._store, idx);
		} else {
			var er = "SimpleDao.remove error: Ojbect " + objectType + "[" + id + "] not found. Cannot delete.";
			snow.log.debug(er);
			throw er;
		}

		return oldData;

	}

	// ------ /DAO Interface Implementation ------ //

	/**
	 * SimpleDao is a Dao for a in memory array based storage. Each data item is stored as an array item,
	 * and have a unique .id property (that will be added on save is not present). <br />
	 *
	 * This is only for development, as there is not storage behind it.
	 *
	 * @param {Array}  store (optional) Array of json object representing each data item
	 */
	snow.dao.SimpleDao = SimpleDao;
})(jQuery);

// ------ /Simple DAO ------ //

// ------ Simple Rel DAO ------ //
(function($) {

	function SimpleRelDao(store, rels) {
		this._super.init.call(this, store);
		this._rels = rels;
		this._relDic = {};
		for (var i = 0, l = rels.length; i < l; i++) {
			this._relDic[rels[i]] = rels[i] + "_id";
		}
	}

	snow.util.inherit(SimpleRelDao, snow.dao.SimpleDao);

	SimpleRelDao.prototype.get = function(objectType, id) {
		var result = this._super.get.call(this, objectType, id);
		return completeData.call(this, result);
	}

	SimpleRelDao.prototype.list = function(objectType, opts) {
		var resultSet = this._super.list.call(this, objectType, opts);

		// Now, go through the list, adn load the other object type.
		if (this._rels) {
			var dao = this;
			$.each(resultSet, function(idx, val) {
				completeData.call(dao, val);
			});

		}

		return resultSet;

	}

	SimpleRelDao.prototype.save = function(objectType, data) {
		// make sure to remove the direct object reference (we expect the rel_id at this point)
		// TODO: probably need to extra the id from the object reference in case there is now rel_id
		if (this._rels) {
			var tmpPropName;
			for (var i = 0, l = this._rels.length; i < l; i++) {
				tmpPropName = this._rels[i];
				if (typeof data[tmpPropName] !== "undefined") {
					delete data[tmpPropName];
				}
			}
		}

		var result = this._super.save.call(this, objectType, data);
		return completeData.call(this, result);
	}

	// ------ Private Helpers ------ //
	// complete the data with the related objects
	function completeData(val) {
		var rels = this._rels;
		var rel, propIdName, obj, objId;
		for (var i = 0; i < rels.length; i++) {
			rel = rels[i];
			propIdName = this._relDic[rel];
			objId = val[propIdName];
			if (typeof objId !== "undefined") {
				obj = snow.dm.get(rel, objId);
				if (typeof obj !== "undefined" && obj != null) {
					val[rel] = obj;
				}
			}
		}
		return val;
	}

	// ------ /Private Helpers ------ //

	/**
	 * SimpleRelDao is a Many to Many Dao that will do a best attempt to join the entities it is responsible to join. <br />
	 *
	 * This is only for development, as there is not storage behind it.
	 *
	 * @param {Array}  store (optional) Array of json object representing each data item
	 */
	snow.dao.SimpleRelDao = SimpleRelDao;
	
})(jQuery);

// ------ jQuery DAO Helper ------ //
(function($) {

	/**
	 * Return the objRef {id,type,$element} (or a list of such) of the closest html element matching the objType match the data-obj_type.<br />
	 * If no objType, then, return the first objRef of the closest html element having a data-obj_type. <br />
	 *
	 * @param {String} objType (optional) the object table
	 * @return null if not found, single object with {id,type,$element} if only one jQuery object, a list of such if this jQuery contain multiple elements.
	 */
	$.fn.sObjRef = function(objType) {
		var resultList = [];

		var obj = null;
		// iterate and process each matched element
		this.each( function() {
			var $this = $(this);
			var $sObj;
			if (objType) {
				$sObj = $this.closest("[data-obj_type='" + objType + "']");
			} else {
				$sObj = $this.closest("[data-obj_type]");
			}
			if ($sObj.length > 0) {
				var objRef = {
					type: $sObj.attr("data-obj_type"),
					id: $sObj.attr("data-obj_id"),
					$element: $sObj
				}
				resultList.push(objRef);
			}
		});

		if (resultList.length === 0) {
			return null;
		} else if (resultList.length === 1) {
			return resultList[0];
		} else {
			return resultList;
		}

	};

})(jQuery);

// ------ /jQuery DAO Helper ------ //