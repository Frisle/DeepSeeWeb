
 /**
 * Controller for widget
 */
(function(){
    'use strict';

    function WidgetCtrl($scope, Lang, TypeMap, gridsterConfig, ngDialog, Filters, BaseWidget, Storage, Connector) {
        var _this = this;
        this._applyFilter = _applyFilter;

        BaseWidget.apply(this, [$scope]);
        $scope.model = {
            error: "",
            filters: Filters.getWidgetModelFilters(this.desc.name)
        };
        _this.updateFiltersText();
        var type = TypeMap.getClass(_this.desc.type);
        if (type) type.apply(this, [$scope]); else {
            _this.supported = false;
            _this.showError(Lang.get("errWidgetNotSupported") + ": " + _this.desc.type);
        }
        if ($scope.model.filters.length === 0 && !this.hasDatasourceChoser && !this.hasActions && !$scope.item.pvItems.length) this.hideToolbar();


        $scope.onInit = this.onInit;
        //$scope.onSizeChange = onSizeChange;
        $scope.requestData = this.requestData;
        $scope.toggleFilter = toggleFilter;

        $scope.$on("refresh-all", function(){_this.requestData();});
        $scope.$on("refresh:" + $scope.item.$$hashKey, function(){_this.requestData();});
        var filterListener = $scope.$on("filter" + _this.desc.name, applyFilter);
        var filterAllListener = $scope.$on("filterAll", applyFilter);
        //$scope.$on('resize', onResize);
        $scope.$on('gridster-item-transition-end', onResize);
        $scope.$on('gridster-resized', onResize);
        $scope.$watch('item.row', onMoveVertical, true);
        $scope.$watch('item.col', onMoveHorizontal, true);
        $scope.$watch('item.sizeX', onResizeHorizontal, true);
        $scope.$watch('item.sizeY', onResizeVertical, true);
        $scope.$on("resetWidgets", resetWidget);
        $scope.$on("setType:" + $scope.item.$$hashKey, changeType);
        $scope.$on("share:" + $scope.item.$$hashKey, share);
        $scope.$on("copyMDX:" + $scope.item.$$hashKey, copyMDX);
        $scope.$on('$destroy', function () {
            filterListener();
            filterAllListener();
        });

        /**
         * Changes widget type. Callback for $on("setType")
         * @param {object} sc Scope
         * @param {string} t Type
         */
        function changeType(sc, t) {
            _this.desc.type = t;
            if ((_this.chart) && (t.indexOf("chart") != -1)) {
                _this.setType(t.replace("chart", ""));
            }
            $scope.$broadcast("typeChanged");
        }

        /**
         * Reset widget position and size
         */
        function resetWidget() {
            var widgets = Storage.getWidgetsSettings(_this.desc.dashboard, Connector.getNamespace());
            var k = _this.desc.name;
            var w = widgets[k];
            if (!w) return;
            delete w.sizeX;
            delete w.sizeY;
            delete w.row;
            delete w.col;
            Storage.setWidgetsSettings(widgets, _this.desc.dashboard, Connector.getNamespace());
        }

        function copyMDX() {
            var mdx = _this.getMDX();
            ngDialog.open({template: 'src/views/share.html', data: { html: mdx }, controller: 'share', showClose: false, className: "ngdialog-theme-default" });
        }

        function share() {
            const c = _this.chart;

            let url = Filters.getFiltersShareUrl();
            let part = url.split('#')[1];
            if (part && part.indexOf('?') === -1)
                url += '?widget=' + $scope.item.idx;
            else
                url += '&widget=' + $scope.item.idx;

            var w, h;
            if ($scope._elem && $scope._elem[0] && $scope._elem[0].offsetParent) {
                w = $scope._elem[0].offsetParent.offsetWidth;
                h = $scope._elem[0].offsetParent.offsetHeight;
            }
            if (h) {
                url += '&height=' + h;
            }

            // Store hidden series
            if (c) {
                const hidden = c.series.map((s, i) => ({v: s.visible, i: i})).filter(s => !s.v);
                if (hidden.length) {
                    url += '&hiddenSeries=' + hidden.map(s => s.i).join(',');
                }
            }

            var html = '<iframe style="border: none" src="' + url + '" ';
            if (w && h) {
                html = html + 'width="' + w + '" ';
                html = html + 'height="' + h + '" ';
            }
            html += '></iframe>';

            ngDialog.open({template: 'src/views/share.html', data: { html: html }, controller: 'share', showClose: false, className: "ngdialog-theme-default" });
        }


        /**
         * Widget resize callback
         */
        function onResize() {
            _this.onResize();
        }

        /**
         * Private callback for filter applying. Can be overriden in custom widgets
         * @private
         */
        function _applyFilter() {
            _this.updateFiltersText();
            _this.requestData();
        }
        /**
         * Apply filter callback
         */
        function applyFilter() {
            _this._applyFilter.apply(_this, arguments);
        }

        /**
         * Shows filter window on widget, when user pressed filter button or filter input
         * @param {number} idx Filter index
         * @param {object} e Event
         */
        function toggleFilter(idx, e) {
            var flt = Filters.getFilter(idx);
            if (!flt) return;
            var obj = e.currentTarget.tagName.toUpperCase() === "INPUT" ? e.currentTarget.nextElementSibling.offsetParent : e.currentTarget.offsetParent.offsetParent;
            if (obj) {
                var rect = obj.getBoundingClientRect();
                changeStyle(".ngdialog.ngdialog-theme-plain .ngdialog-content", "margin-left", rect.left + "px");
                if (dsw.mobile) {
                    changeStyle(".ngdialog.ngdialog-theme-plain .ngdialog-content", "margin-top", "0px");
                    changeStyle(".ngdialog.ngdialog-theme-plain .ngdialog-content", "margin-left", "0px");
                    changeStyle(".ngdialog.ngdialog-theme-plain .ngdialog-content", "width", window.innerWidth + "px");
                    changeStyle(".ngdialog.ngdialog-theme-plain .ngdialog-content", "height", "100%");
                } else {
                    changeStyle(".ngdialog.ngdialog-theme-plain .ngdialog-content", "margin-top", (rect.top + 16) + "px");
                }
            }

            var className = "ngdialog-theme-plain";
            if (dsw.mobile) className += " ngdialog-mobile";
            ngDialog.open({template: 'src/views/filter.html', data: {filter: flt, dataSource: _this.desc.dataSource, widget: _this}, controller: "filter", showClose: false, className: className });
        }

        /**
         * Callback for moving widget horizontally
         * @param {undefined} a Not used
         * @param {undefined} b Not used
         * @param {object} $scope Scope
         */
        function onMoveHorizontal(a, b, $scope){
            if (!gridsterConfig.isDragging) return;
            if (!isNaN($scope.item.row)) {
                var widgets = Storage.getWidgetsSettings(_this.desc.dashboard, Connector.getNamespace());
                var k = _this.desc.name;
                if (!widgets[k]) widgets[k] = {};
                widgets[k].col = $scope.item.col;
                Storage.setWidgetsSettings(widgets, _this.desc.dashboard, Connector.getNamespace());
            }
        }

        /**
         * Callback for moving widget vertically
         * @param {undefined} a Not used
         * @param {undefined} b Not used
         * @param {object} $scope Scope
         */
        function onMoveVertical(a, b, $scope){
            if (!gridsterConfig.isDragging) return;
            if (!isNaN($scope.item.row)) {
                var widgets = Storage.getWidgetsSettings(_this.desc.dashboard, Connector.getNamespace());
                var k = _this.desc.name;
                if (!widgets[k]) widgets[k] = {};
                widgets[k].row = $scope.item.row;
                Storage.setWidgetsSettings(widgets, _this.desc.dashboard, Connector.getNamespace());
            }
        }

        /**
         * Callback for sizing widget horizontally
         * @param {undefined} a Not used
         * @param {undefined} b Not used
         * @param {object} $scope Scope
         */
        function onResizeHorizontal(a, b, $scope){
            if (!gridsterConfig.isResizing) return;
            if (!isNaN($scope.item.sizeX)) {
                var widgets = Storage.getWidgetsSettings(_this.desc.dashboard, Connector.getNamespace());
                var k = _this.desc.name;
                if (!widgets[k]) widgets[k] = {};
                widgets[k].sizeX = $scope.item.sizeX;
                Storage.setWidgetsSettings(widgets, _this.desc.dashboard, Connector.getNamespace());
            }
        }

        /**
         * Callback for sizing widget vertically
         * @param {undefined} a Not used
         * @param {undefined} b Not used
         * @param {object} $scope Scope
         */
        function onResizeVertical(a, b, $scope) {
            if (!gridsterConfig.isResizing) return;
            if (!isNaN($scope.item.sizeY)) {
                var widgets = Storage.getWidgetsSettings(_this.desc.dashboard, Connector.getNamespace());
                var k = _this.desc.name;
                if (!widgets[k]) widgets[k] = {};
                widgets[k].sizeY = $scope.item.sizeY;
                Storage.setWidgetsSettings(widgets, _this.desc.dashboard, Connector.getNamespace());
            }
        }

        /**
         * Changes ngDialog css rules to set modal position to the desired place
         * @param {string} selectorText Selector to find elements
         * @param {string} style Style attribute to change
         * @param {string} value Attribute value
         */
        function changeStyle(selectorText, style, value) {
            var theRules = [];
            for (var i = 0; i < document.styleSheets.length; i++) {
                if (document.styleSheets[i].cssRules) {
                    theRules = document.styleSheets[i].cssRules;
                }
                else if (document.styleSheets[i].rules) {
                    theRules = document.styleSheets[i].rules;
                }
                for (var n in theRules) {
                    if (theRules[n].selectorText == selectorText) {
                        theRules[n].style[style] = value;
                    }
                }
            }
        }
    }

    angular.module('widgets')
        .controller('widget', ['$scope', 'Lang', 'TypeMap', 'gridsterConfig', 'ngDialog', 'Filters', 'BaseWidget', 'Storage', 'Connector', WidgetCtrl]);

})();