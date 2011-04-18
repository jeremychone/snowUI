var snow = snow || {};

(function(){
	
	snow.dm = {};
	
	var daoDic = {};
	
	//changeEventListenersby objectType
	var daoChangeEventListeners = {};
	
	function getDao(objectType){
		return daoDic[objectType];
	};	
	
	//public
	snow.dm.registerDao = function(objectType,dao){
		daoDic[objectType] = dao;
	}; 
	
	// Add a change listener function for an objectType
	// Will Change listener will get called on save and remove
	// TODO: needs to support "all" (i.e. jsut the listener, which means get triggered on every objectType)
	snow.dm.addChangeListener = function(objectType,listener){
		var listeners = daoChangeEventListeners[objectType];
		if (!listeners){
			listeners = [];
			daoChangeEventListeners[objectType] = listeners;
		}
		daoChangeEventListeners[objectType] = listeners; 
		listeners.push(listener);
	};
	
	// ------- DAO Delegator ------ //
	/**
	 * Get the id for a data object. This is usefull for the framework to know how to retrieve an id from an object. 
	 * @param {Object} data
	 * @return the id (this is not deferred)
	 */
	snow.dm.getId = function (objectType,data){
		var dao = getDao(objectType);
		if (dao){
			return dao.getId(objectType,data);		
		}else{
			snow.log.error("cannot find the DAO for objectType: " + objectType);
		}		
	}; 
	
	/**
	 * Return a deferred object that will resolve with the object for a give objectType/ID.
	 * @param {Object} objectType
	 * @param {Object} id
	 * @return 
	 */
	snow.dm.get = function(objectType,id){
		var r, dao = getDao(objectType);
		if (dao){
			return wrapWithDeferred(dao.get(objectType,id)).promise();
		}else{
			snow.log.error("Cannot find the DAO for objectType: " + objectType);
		}	
	};	
	
	/**
	 * 
	 * @param {Object} objectType
	 * @param {Object} opts (not supported yet)
	 *           opts.pageIndex {Number} Index of the page, starting at 0.
	 *           opts.pageSize  {Number} Size of the page
	 *           opts.like      {Object}
	 *           opts.orderBy   {String}
	 *           opts.orderType {String} "asc" or "desc"
	 */
	snow.dm.find = function(objectType,opts){
		var dao = getDao(objectType);
		if (dao){
			//TODO need to support variable params
			return wrapWithDeferred(dao.find(objectType,opts)).promise();	
		}else{
			snow.log.error("Cannot find the DAO for objectType" + objectType);
		}	
	};	
	
	snow.dm.save = function(objectType,data){
		var dao = getDao(objectType);
		if (dao && dao.save){
			var dfd = wrapWithDeferred(dao.save(objectType,data));
			dfd.done(function(newData){
				callChangeListeners(objectType,"save",null,newData,data);	
			});
			return dfd.promise();
		}else{
			snow.log.error("Cannot find the DAO or save method for objectType" + objectType);
		}	
	};
	
	
	snow.dm.remove = function(objectType,id){
		var dao = getDao(objectType);
		if (dao){
			var dfd = wrapWithDeferred(dao.remove(objectType,id));
			
			dfd.done(function(removeObj){
				snow.dm.get(objectType,id).done(function(removedObject){
					callChangeListeners(objectType,"remove",removedObject,null,null);	
				});
			});
			
			return dfd.promise();
		}else{
			snow.log.error("Cannot find the DAO for objectType" + objectType);
		}	
	};
	
	// ------- /DAO Delegator ------ //
	
	/**
	 * Private method to trigger the change(daoEvent) on all listeners.
	 * NOTE: this param names maps to what is daoChangeEvent
	 * 
	 * @param {Object} objectType
	 * @param {Object} action ("remove" or "save")
	 * @param {Object} oldData The data prior to the change (not supported today for save)
	 * @param {Object} newData The data after the change (null if remove)
	 * @param {Object} saveData The data object that was passed to dm.save
	 */
	function callChangeListeners(objectType,action,oldData,newData,saveData){
		var listeners = daoChangeEventListeners[objectType],
			listener;
		
		var daoChangeEvent = {objectType: objectType,
					    action: action,
						oldData: oldData,
						newData: newData,
						saveData: saveData};
			
		if (listeners){
			for (var i = 0; i < listeners.length; i++ ){
				listeners[i](daoChangeEvent);	
			}
		}
	};
	
	/**
	 * Wrap with a deferred object if the obj is not a deferred itself. 
	 */
	function wrapWithDeferred(obj){
		//if it is a deferred, then, trust it, return it. 
		if (obj && $.isFunction(obj.promise)){
			return obj;
		}else{
			var dfd = $.Deferred();
			dfd.resolve(obj);
			return dfd;
		}
	}
	
	
})();

// ------ Simple DAO ------ //
snow.dao = {};

(function(){
	/**
	 * SimpleDao is a Dao for a array based storage. Each data item is stored as an array item, 
	 * and have a unique .id property (that will be added on save is not present).
	 * 
	 * Note that instance of a SimpleDao is only for single object type.
	 * 
	 * @param {Array}  store (optional) Array of json object representing each data item
	 * @param {Object} opts  (optional) Dao options (not supported yet)
	 */
	function SimpleDao(store,opts){
		this._store = store || [];
	}
	// ------ DAO Interface Implementation ------ //
	SimpleDao.prototype.getId = function(data){
		return data.id;
	}
	
	SimpleDao.prototype.get = function(objectType,id){
		var idx = snow.util.array.getIndex(this._store,"id",id);
		return this._store[idx];
	}
	
	//for nos, just support opts.orderBy
	SimpleDao.prototype.find = function(objectType,opts){
		//TODO: probably need to copy the array to avoid giving the original array
		var resultSet = this._store;
		
		if (opts){
			if (opts.orderBy){
				resultSet = snow.util.array.sortBy(resultSet,opts.orderBy)	
			}
		}
		return resultSet;
	}
	
	SimpleDao.prototype.save = function(objectType,data){
		// if it is an update
		if (data.id){
			var storeData = this.get(objectType,data.id);
			if (storeData) {
				$.extend(storeData, data);
				return storeData;
			}
		}
		
		// if we are here, it means we need to add the data
		
		// if the id has already been created, no biggies, otherwise, create it.
		if (typeof data.id === "undefined"){
			data.id = snow.util.uuid(12);
		}
			
		this._store.push(data);
		
		return data;
	}
	
	SimpleDao.prototype.remove = function(objectType,id){
		var idx = snow.util.array.getIndex(this._store,"id",id);
		if (idx > -1) {
			snow.util.array.remove(this._store, idx);
		}
	}	
	// ------ /DAO Interface Implementation ------ //
	
	snow.dao.SimpleDao = SimpleDao;
})();
// ------ /Simple DAO ------ //		

// ------ jQuery DAO Helper ------ //
(function($) {

  /**
   * get the dataObjectId from an element or its ancestors for a given objectType
   * @param {prefix} prefix
   */
  $.fn.sDataObjectId = function(objectType) {
	  var objId
	  
      // iterate and process each matched element
      this.each(function() {
	  	var $this = $(this);
		var $objElement = $this.closest("[data-obj_type='" + objectType + "']" );
		objId = $objElement.attr("data-obj.id");
      });
	  
	  return objId; 

   }; 


})(jQuery);

(function($) {

  /**
   * get the dataObject deferred from an element or its ancestors for a given objectType
   * @param {prefix} prefix
   */
  $.fn.sDataObject = function(objectType) {
	  var obj = null;
      // iterate and process each matched element
      this.each(function() {
	  	var $this = $(this);
		var objId = $this.sDataObjectId(objectType);
		obj =  snow.dm.get(objectType,objId);
      }); 
	 return obj;
   }; 


})(jQuery);
// ------ /jQuery DAO Helper ------ //