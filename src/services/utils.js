/**
 * Service contains utility functions
 */
(function() {
    'use strict';

    function UtilsSvc() {
        var _this = this;
        this.merge = mergeRecursive;
        this.removeExt = removeExt;
        this.replaceFilename = replaceFilename;
        this.isEmbedded = isEmbedded;

        function removeExt(fileName) {
            var a = fileName.split(".");
            if (a.length === 1) return fileName;
            a.pop();
            return a.join(".");
        }

        function replaceFilename(oldName, newName) {
            var a = oldName.split("/");
            a[a.length - 1] = newName;
            return a.join("/");
        }

        function isEmbedded() {
            var params = window.location.hash.replace("?", "").replace("#/", "").split("&");
            for (var i = 0; i < params.length; i++) {
                if (params[i].indexOf('widget=') !== -1) return true;
            }
            return params.indexOf("embed=1") !== -1;
        }

        /**
         * Merger all object properties to another
         * @param {object} obj1 Object to merge properties in
         * @param {object} obj2 Object to read properties from
         * @returns {object} obj1 contains all properties from obj2
         */
        function mergeRecursive(obj1, obj2) {
            // If object is array, construct new array and make clone
            if (obj2.constructor === Array) {
                obj1 = [];
                for (var i = 0; i < obj2.length; i++) {
                    if (typeof obj2[i] === "object") obj1[i] = mergeRecursive({}, obj2[i]); else obj1[i] = obj2[i];
                }
                return obj1;
            }

            for (var p in obj2) {
                if (!obj2.hasOwnProperty(p)) continue;
                try {
                    // Property in destination object set; update its value.
                    if (obj2[p].constructor == Object) {
                        obj1[p] = mergeRecursive(obj1[p] || {}, obj2[p]);
                    }
                    if (obj2[p].constructor == Object) {
                        obj1[p] = mergeRecursive(obj1[p] || [], obj2[p]);
                    }
                    else {
                        obj1[p] = obj2[p];
                    }
                } catch (e) {
                    // Property in destination object not set; create it and set its value.
                    obj1[p] = obj2[p];
                }
            }
            return obj1;
        }

    }

    angular.module('app')
        .service('Utils', UtilsSvc);

})();
