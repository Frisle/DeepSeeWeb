(function() {
    'use strict';

    angular.module('app')
        .directive('pivot', ['$parse', '$compile', 'Lang', 'Connector', function($parse, $compile, Lang, Connector) {
            return {
                link: function(scope, element, attrs) {
                    var desc = scope.getDesc(scope.item.idx);

                    var setup = {
                        container: element[0],
                        dataSource: {
                            pivot: desc.dataSource,
                            MDX2JSONSource: Connector.url.substring(0, Connector.url.length - 1),
                            basicMDX: scope.item.pivotMdx,
                            namespace: Connector.getNamespace(),
                            sendCookies: true
                        },
                        columnResizeAnimation: true,
                        showSummary: true,
                        //loadingMessageHTML: '<div class="loader"></div>',
                        locale: Lang.current,
                        formatNumbers: "#,###.##"
                    };
                    delete scope.model.pivotMdx;

                    var lpt = new LightPivotTable(setup);
                    if (scope.onInit) scope.onInit(lpt);
                }
            };
        }]);

})();