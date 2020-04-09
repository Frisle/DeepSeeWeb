/**
 * Map widget class factory
 */
(function() {
    'use strict';

    function MapWidgetFact(Storage, CONST, $timeout, Connector) {

        function MapWidget($scope) {
            var _this = this;
            this.CLUSTER_RANGE = 1;
            this.map = null;
            this.markers = null;
            this.polys = null;
            this.iconStyle = null;
            this.popup = null;
            this.isRGBColor = false;
            // Selected deature for mobile version to make drill after second tap
            this._selectedFeature = null;
            _this.featureOverlay = null;
            $scope.model.tooltip = {
                visible: false,
                content: ""
            };
            this.onInit = onInit;
            this.onResize = onResize;
            this._retrieveData = retrieveData;
            this.requestData();
            _this.mapData = null;

            $scope.item.drillUp = doDrillUp;
            $scope.model.tooltip.name = "";
            $scope.model.tooltip.items = [];
            $scope.item.displayAsPivot = displayAsPivot;
            $scope.item.isMap = true;

            var polys = null;
            requestPolygons();

            /**
             * Back button click handler
             */
            function doDrillUp() {
                hideTooltip();
                _this.doDrill();
            }

            /**
             * Displays chart as pivot widget
             */
            function displayAsPivot(customMdx) {
                hideTooltip();
                $scope.rejectTooltipCreation();
                if (_this.desc.type === "pivot") {
                    $scope.item.isDrillthrough = null;
                    _this.restoreWidgetType();
                } else {
                    $scope.item.pivotMdx = customMdx || _this.getMDX();
                    _this.changeWidgetType("pivot");
                    //_this.desc.oldType = _this.desc.type;
                    //_this.desc.type = "pivot";

                    ///$scope.$broadcast("typeChanged");
                    //$scope.$destroy();
                }
            }

            function requestPolygons() {
                var fileName = _this.desc.name + ".js";
                if (_this.desc.properties && _this.desc.properties.coordsJsFile) fileName = _this.desc.properties.coordsJsFile;
                var folder = Storage.serverSettings.DefaultApp || "/csp";
                var url = folder + "/" + fileName;

                // For dev on locahost take connector redirect url
                if (window.location.host.split(':')[0].toLowerCase() === 'localhost') {
                    url = localStorage.connectorRedirect.split('/').slice(0, -2).join('/') + url;
                } else {
                    if (dsw.mobile) {
                        url = localStorage.connectorRedirect.split('/').slice(0, -2).join('/') + url;
                    } else {
//                if (localStorage.connectorRedirect) url="huPolygons.js";
                        //if (localStorage.connectorRedirect) url="rfpolygons.js";
                        //if (localStorage.connectorRedirect) url="uspolygons.js";
                        if (localStorage.connectorRedirect) url = "map.js";

                        //if (localStorage.connectorRedirect) url="polys/mapOrig.js";

                        //if (localStorage.connectorRedirect) url="mospolygons.js";
                        //if (localStorage.connectorRedirect) url = localStorage.connectorRedirect.replace("MDX2JSON/", "").split("/").slice(0, -1).join("/") + "/csp/" + Connector.getNamespace() + "/" + fileName;
                    }
                }
                // url = 'uspolygons.js';
                Connector.getFile(url).then(onPolyFileLoaded);
            }

            function onPolyFileLoaded(result) {
                polys = {};
                result = "(" + result + ")(polys)";
                // TODO: make safe eval
                eval(result);
                //setTimeout(buildPolygons, 2000);
                buildPolygons();
            }

            function colorGradient(fadeFraction, rgbColor1, rgbColor2, rgbColor3) {
                var color1 = rgbColor1;
                var color2 = rgbColor2;
                var fade = fadeFraction;

                // Do we have 3 colors for the gradient? Need to adjust the params.
                if (rgbColor3) {
                    fade = fade * 2;

                    // Find which interval to use and adjust the fade percentage
                    if (fade >= 1) {
                        fade -= 1;
                        color1 = rgbColor2;
                        color2 = rgbColor3;
                    }
                }

                var diffRed = color2.red - color1.red;
                var diffGreen = color2.green - color1.green;
                var diffBlue = color2.blue - color1.blue;

                var gradient = {
                    red: parseInt(Math.floor(color1.red + (diffRed * fade)), 10),
                    green: parseInt(Math.floor(color1.green + (diffGreen * fade)), 10),
                    blue: parseInt(Math.floor(color1.blue + (diffBlue * fade)), 10),
                };

                return 'rgb(' + gradient.red + ',' + gradient.green + ',' + gradient.blue + ')';
            }

            function getFeatureColor(name, value) {
                var item = _this.mapData.Cols[1].tuples.filter(function(el) { return el.caption === name; });
                if (item.length === 0) return;
                item = item[0];
                var parts;


                var idx = _this.mapData.Cols[1].tuples.indexOf(item);
                var l = _this.mapData.Cols[0].tuples.length;
                var colorProp = 'ColorExplicitValue';
                if (_this.desc.properties && _this.desc.properties.colorProperty !== undefined) colorProp = _this.desc.properties.colorProperty;
                var color;
                if (isNaN(parseInt(colorProp))) {
                    color = _this.mapData.Cols[0].tuples.filter(function (el) {
                        return el.caption === colorProp;
                    });
                } else {
                    color = _this.mapData.Cols[0].tuples.slice(colorProp, 1);
                }
                if (color.length !== 0) {
                    color = color[0];
                    var colorIdx = _this.mapData.Cols[0].tuples.indexOf(color);
                    var col = _this.mapData.Data[idx * l + colorIdx];
                    if (col.indexOf("rgba") === -1) {
                        col = col.replace("rgb", "rgba");
                        col = col.substr(0, col.length - 1) + ", 0)";
                    }
                    parts = col.split(",");
                    parts[3] = "0.4)";
                    return parts.join(",");
                } else {
                    var f = "hsl((255-x)/255 * 120, 100%, 50%)";
                    if (_this.isRGBColor) {
                        f = "rgb(x, 255-x, 0)";
                    }
                    //if (!_this.desc.properties || !_this.desc.properties.colorProperty) f = "hsl((255-x)/255 * 120, 100%, 50%)";
                    if (_this.desc.properties && _this.desc.properties.colorFormula) f = _this.desc.properties.colorFormula;
                    var fidx = f.indexOf("(");
                    var firstPart = f.substring(0, fidx).toLowerCase();
                    f = f.substring(fidx + 1, f.length - 1);
                    parts = f.split(",");
                    var x = value || 0;
                    var tmp;
                    for (var i = 0; i < parts.length; i++) {
                        if (parts[i].indexOf("x") === -1) continue;
                        parts[i] = parts[i].replace(/x/g, x.toString());
                        eval("tmp = " + parts[i] + ";");
                        if (tmp > 255) tmp = 255;
                        if (tmp < 0) tmp = 0;
                        parts[i] = Math.floor(tmp).toString();
                    }

                    // return colorGradient(x/255, {red: 0, green: 255, blue: 0}, {red: 255, green: 255, blue: 0}, {red: 255, green: 0, blue: 0});
                    return firstPart + "a(" + parts.join(",") + ", 0.65)";
                    //console.log("hsla(" + parts.join(",") + ", 0.3)");
                    //return "hsla(" + parts.join(",") + ", 0.5)";
                }
            }

            function centerView(min, max) {
                var lat;
                var lon;
                var zoom;
                if (_this.desc.properties) {
                    lat = parseFloat(_this.desc.properties.latitude);
                    lon = parseFloat(_this.desc.properties.longitude);
                    zoom = parseFloat(_this.desc.properties.zoom);
                }

                if (_this.drills.length === 0 && (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) && (lat !== undefined && lon !== undefined && zoom !== undefined)) {
                    _this.map.getView().setCenter(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:900913'));
                    _this.map.getView().setZoom(zoom);
                } else {
                    if (Math.abs(min[0] - max[0]) < 0.00000001 && Math.abs(min[1] - max[1]) < 0.00000001) return;
                    var p1 = ol.proj.transform([min[0], min[1]], 'EPSG:4326', 'EPSG:900913');
                    var p2 = ol.proj.transform([max[0], max[1]], 'EPSG:4326', 'EPSG:900913');
                    //console.log([p1[0], p1[1], p2[0], p2[1]]);
                    //console.log(_this.map.getSize());
                    _this.map.getView().fit([p1[0], p1[1], p2[0], p2[1]], _this.map.getSize());
                    /*_this.map.getView().fit([p1[0], p1[1], p2[0], p2[1]], _this.map.getSize(),
                        {
                            padding: [10, 10, 10, 10],
                            constrainResolution: true,
                            nearest: true
                        });*/
                }
            }

            function buildPolygons() {
                var lon, lat, zoom, i, p, k, l, t, value, parts, idx, item;
                _this.isRGBColor = false;
                var colorProperty = "ColorHSLValue";
                if (_this.desc.properties && _this.desc.properties.colorClientProperty) colorProperty = _this.desc.properties.colorClientProperty;
                var coordsProperty = 'CoordKeyValue';
                if (_this.desc.properties && _this.desc.properties.coordsProperty) coordsProperty = _this.desc.properties.coordsProperty;
                if (!polys || !_this.map || !_this.mapData) return;
                var features = [];
                l = _this.mapData.Cols[0].tuples.length;
                var minV = Number.MAX_VALUE;
                var maxV = Number.MIN_VALUE;

                var colorPropertyIdx = 0;
                if (isNaN(parseInt(colorProperty))) {
                    item = _this.mapData.Cols[0].tuples.filter(function(el) { return el.caption === colorProperty; });
                    colorPropertyIdx = _this.mapData.Cols[0].tuples.indexOf(item[0]);
                    if (colorPropertyIdx === -1) {
                        _this.isRGBColor = true;
                        colorProperty = "ColorRGBValue";
                        item = _this.mapData.Cols[0].tuples.filter(function(el) { return el.caption === colorProperty; });
                        colorPropertyIdx = _this.mapData.Cols[0].tuples.indexOf(item[0]);
                    }
                } else {
                    colorPropertyIdx = parseInt(_this.desc.properties.colorProperty) || 0;
                }

                for (t = 0; t < _this.mapData.Cols[1].tuples.length; t++) {
                    value = _this.mapData.Data[t * l + colorPropertyIdx];
                    if (value < minV) minV = value;
                    if (value > maxV) maxV = value;
                }

                var min = [99999999, 99999999];
                var max = [-99999999, -99999999];

                var count = 0;
                //polyCoordProp  = _this.desc.proper Polygon Coords property

                // TODO: new iteration
                idx = -1;
                item = _this.mapData.Cols[0].tuples.filter(function(el) { return el.caption === coordsProperty; });
                // If not found find by Key
                if (item.length === 0) {
                    item = _this.mapData.Cols[0].tuples.filter(function(el) { return el.caption === "Key"; });
                }
                if (item.length !== 0) {
                    idx = _this.mapData.Cols[0].tuples.indexOf(item[0]);
                }
                for (t = 0; t < _this.mapData.Cols[1].tuples.length; t++) {
                    //if (t !== 0) continue;

                    var key = _this.mapData.Cols[1].tuples[t].caption;
                    var pkey = key;
                    if (idx !== -1) pkey = _this.mapData.Data[t * l + idx];
                    if (!polys[pkey]) continue;

                    parts = polys[pkey].split(';');
                    var poly = [];
                    count++;


                    for (k = 0; k < parts.length; k++) {
                        if (!parts[k]) continue;
                        var coords = parts[k].split(' ');

                        var polyCoords = [];
                        for (i in coords) {
                            if (!coords[i]) continue;
                            var c = coords[i].split(',');
                            if (c.length < 2) continue;
                            lon = parseFloat(c[0]);
                            lat = parseFloat(c[1]);

                            if (isNaN(lon) || isNaN(lat)) {
                                console.warn("Wrong poly coordinates: ", coords[i]);
                                continue;
                            }

                            var point = new ol.geom.Point([lon, lat]);
                            point.transform('EPSG:4326', 'EPSG:3857');

                            var ll = lon;
                            if (ll < 0) ll += 360;
                            if (parseFloat(ll) < min[0]) min[0] = parseFloat(ll);
                            if (parseFloat(lat) < min[1]) min[1] = parseFloat(lat);
                            if (parseFloat(ll) > max[0]) max[0] = parseFloat(ll);
                            if (parseFloat(lat) > max[1]) max[1] = parseFloat(lat);
                            polyCoords.push(point.getCoordinates());
                        }

                        poly.push(polyCoords);

                        if (poly.length >300) {
                            var tmp = [];
                            for (i = 0; i < poly.length; i+=2) {
                                tmp.push(poly[i]);
                            }
                            poly = tmp;
                        }
                    }

                    // Find poly title
                    var polyTitle = key;
                    if (_this.desc.properties && _this.desc.properties.polygonTitleProperty) {
                        var it = _this.mapData.Cols[0].tuples.filter(function (el) {
                            return el.caption === (_this.desc.properties.polygonTitleProperty || "Name");
                        });
                        if (it.length !== 0) {
                            var tidx = _this.mapData.Cols[0].tuples.indexOf(it[0]);
                            if (tidx !== -1) {
                                polyTitle = _this.mapData.Data[t * l + tidx];
                            }
                        }
                    }
                    //poly = poly.reverse();
                    var feature = new ol.Feature({
                        geometry: new ol.geom.Polygon(poly),
                        //geometry: new ol.geom.MultiPolygon([poly]),
                        key: key,
                        title:  polyTitle,
                        dataIdx: t * l,
                        path: _this.mapData.Cols[1].tuples[t].path,
                        desc: _this.mapData.Cols[1].tuples[t].title
                    });

                    value = _this.mapData.Data[t * l + colorPropertyIdx];
                    feature.setStyle(new ol.style.Style({
                        zIndex: 0,
                        fill: new ol.style.Fill({
                            color: (getFeatureColor(key, ((value - minV) * 255) / (maxV - minV))) || "none"
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'rgba(0, 0, 0, 0.3)',
                            width: 1
                        })
                    }));
                    //console.log(getFeatureColor(key, ((maxV - value) * 255) / (maxV - minV)));
                    features.push(feature);
                }

                _this.featureOverlay.getSource().clear();
                _this.polys.clear();
                _this.polys.addFeatures(features);
                centerView(min, max);
            }

            /**
             * Fills widget with data retrieved from server
             * @param {object} result Result of MDX query
             */
            function retrieveData(result) {
                hideTooltip();
                _this.markers.clear();
                _this.mapData = result;
                buildPolygons();

                var min = [Number.MAX_VALUE, Number.MAX_VALUE];
                var max = [Number.MIN_VALUE, Number.MIN_VALUE];

                if (result && _this.map) {
                    var size = result.Cols[0].tuples.length;
                    var k = 0;
                    var features = [];
                    var latitudeProperty = "latitude";
                    if (_this.desc.properties && _this.desc.properties.latitudeProperty) latitudeProperty = _this.desc.properties.latitudeProperty;
                    var longitudeProperty  = "longitude";
                    if (_this.desc.properties && _this.desc.properties.longitudeProperty) longitudeProperty = _this.desc.properties.longitudeProperty;
                    var latIdx = -1;
                    var lonIdx = -1;
                    var item = result.Cols[0].tuples.filter(function(el) { return el.caption.toLowerCase() === latitudeProperty; });
                    if (item.length !== 0) lonIdx = result.Cols[0].tuples.indexOf(item[0]);
                    item = result.Cols[0].tuples.filter(function(el) { return el.caption.toLowerCase() === longitudeProperty; });
                    if (item.length !== 0) latIdx = result.Cols[0].tuples.indexOf(item[0]);

                    if (lonIdx === -1 || latIdx === -1) return;

                    for (var i = 0; i < result.Cols[1].tuples.length; i++) {
                        if (result.Data[k+latIdx] === "" || result.Data[k+latIdx] === undefined ||
                            result.Data[k+lonIdx] === "" || result.Data[k+lonIdx] === undefined) continue;
                        var lat = parseFloat(result.Data[k+latIdx] || 0);
                        var lon = parseFloat(result.Data[k+lonIdx] || 0);
                        var name = result.Cols[1].tuples[i].caption;
                        ///var point = new ol.geom.Point([lon, lat]);
                        var point = new ol.geom.Point([lat, lon]);
                        //var point = new ol.geom.Point([48.584626, 53.1613304]);
                        point.transform('EPSG:4326', 'EPSG:900913');

                        var labels = [];
                        var values = [];
                        for (var j = 2; j < result.Cols[0].tuples.length; j++) {
                            labels.push(result.Cols[0].tuples[j].caption);
                            values.push(result.Data[k + j]);
                        }

                        var iconFeature = new ol.Feature({
                            geometry: point,
                            name: name,
                            labels: labels,
                            values: values,
                            dataIdx: k,
                            path: result.Cols[1].tuples[i].path,
                            desc: result.Cols[1].tuples[i].title
                        });
                        if (parseFloat(lon) < min[1]) min[1] = parseFloat(lon);
                        if (parseFloat(lat) < min[0]) min[0] = parseFloat(lat);
                        if (parseFloat(lon) > max[1]) max[1] = parseFloat(lon);
                        if (parseFloat(lat) > max[0]) max[0] = parseFloat(lat);

                        if (min[0] == max[0]) {
                            min[0] -= 0.25;
                            max[0] += 0.25;
                        }
                        if (min[1] == max[1]) {
                            min[1] -= 0.25;
                            max[1] += 0.25;
                        }

                        features.push(iconFeature);
                        k += size;
                    }

                    if (features.length !== 0) {
                        _this.markers.addFeatures(features);
                        centerView(min, max);
                    }


                   /* var p1 = ol.proj.transform([min[0], min[1]], 'EPSG:4326', 'EPSG:900913');
                    var p2 = ol.proj.transform([max[0], max[1]], 'EPSG:4326', 'EPSG:900913');
                    if (features.length !== 0) _this.map.getView().fit([p1[0], p1[1], p2[0], p2[1]], _this.map.getSize());

                    _this.map.updateSize();*/
                }

            }

            /**
             * Called after widget is initialized by directive
             * @param {object} map OpenLayer3 map object
             */
            function onInit(map) {
                _this.map = map;
                $timeout(onResize, 0);


                /*var iconFeature = new ol.Feature({
                    geometry: new ol.geom.Point([0, 0]),
                    name: 'Null Island',
                    population: 4000,
                    rainfall: 500
                });

                iconFeature.setStyle(iconStyle);

                var vectorSource = new ol.source.Vector({
                    features: [iconFeature]
                });

                var vectorLayer = new ol.layer.Vector({
                    source: vectorSource
                });
                _this.map.addLayer(vectorLayer);*/


                // Create style for marker
                _this.iconStyle = new ol.style.Style({
                    zIndex: 100,
                    image: new ol.style.Icon({
                        anchor: [0.5, 40],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'pixels',
                        opacity: 1,
                        src: 'img/map-marker-red.png'
                    })
                });


                _this.polyStyle = new ol.style.Style({
                    zIndex: 0,
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 0, 0.5)',
                        width: 1
                    })/*,
                    fill: new ol.style.Fill({
                        color: 'yellow'
                    })*/
                });

                _this.hoverStyle = new ol.style.Style({
                    zIndex: 1,
                    stroke: new ol.style.Stroke({
                        color: 'blue',
                        width: 2
                    })
                });

                // Setup polys
                _this.polys = new ol.source.Vector({
                    features: []
                });
                var vectorLayer = new ol.layer.Vector({
                    source: _this.polys,
                    style: _this.polyStyle
                });
                vectorLayer.setZIndex(1);
                _this.map.addLayer(vectorLayer);

                // Setup clustering
                _this.markers = new ol.source.Vector({
                    features: []
                });
                /*var clusterSource = new ol.source.Cluster({
                    distance: _this.CLUSTER_RANGE,
                    source: _this.markers
                });*/

                // Create overlay for hover
                var collection = new ol.Collection();
                _this.featureOverlay = new ol.layer.Vector({
                    map: map,
                    source: new ol.source.Vector({
                        features: collection,
                        useSpatialIndex: false // optional, might improve performance
                    }),
                    style: _this.hoverStyle ,
                    updateWhileAnimating: true, // optional, for instant visual feedback
                    updateWhileInteracting: true // optional, for instant visual feedback
                });
                _this.featureOverlay.setZIndex(10);
                _this.featureOverlay.setMap(_this.map);
                //_this.map.addLayer(_this.featureOverlay);


                // Create layer for markers
                vectorLayer = new ol.layer.Vector({
                    source: _this.markers,
                    style: _this.iconStyle
                });
                vectorLayer.setZIndex(100);
                _this.map.addLayer(vectorLayer);


                // Create popup
                _this.popup = new ol.Overlay({
                    element: $scope.popupElement,
                    positioning: 'bottom-center',
                    offset: [0, -40],
                    stopEvent: false
                });
                _this.map.addOverlay(_this.popup);


                _this.map.on('click', onMapClick);
                _this.map.on('pointermove', onPointerMove);
                //_this.map.getView().on('change:resolution', constrainPan);
                //_this.map.getView().on('change:center', constrainPan);
            }
/*
            function constrainPan() {
                var extent = [-10, -10, 10, 10];
                var view = _this.map.getView();
                var visible = view.calculateExtent(_this.map.getSize());
                var centre = view.getCenter();
                var delta;
                var adjust = false;
                if ((delta = extent[0] - visible[0]) > 0) {
                    adjust = true;
                    centre[0] += delta;
                } else if ((delta = extent[2] - visible[2]) < 0) {
                    adjust = true;
                    centre[0] += delta;
                }
                if ((delta = extent[1] - visible[1]) > 0) {
                    adjust = true;
                    centre[1] += delta;
                } else if ((delta = extent[3] - visible[3]) < 0) {
                    adjust = true;
                    centre[1] += delta;
                }
                if (adjust) {
                    view.setCenter(centre);
                }
            }*/

            function onPointerMove(e) {
                if (dsw.mobile) {
                    if (evt.originalEvent.touches && e.originalEvent.touches.length !== 1) return;
                }

                $scope.hideTooltip();


                var feature = _this.map.forEachFeatureAtPixel(e.pixel,
                    function (feature, layer) {
                        return feature;
                    });
                if (feature) {
                    var dataIdx = feature.get("dataIdx");
                    var title;
                    var titleProp = "TooltipValue";
                    if (_this.desc.properties && _this.desc.properties.markerTitleProperty) titleProp = _this.desc.properties.markerTitleProperty;
                    title = _this.getDataByColumnName(_this.mapData, titleProp || "Name", dataIdx);
                    if (!title && _this.desc.properties.polygonTitleProperty && feature.get("title")) title = feature.get("title");
                    if (!title) title = _this.getDataByColumnName(_this.mapData, "Name", dataIdx);
                    if (!title) title = (_this.mapData.Cols[1].tuples[Math.floor(dataIdx / _this.mapData.Cols[0].tuples.length)].caption || "");
                    if (title) $scope.showTooltip(title, e.originalEvent.pageX, e.originalEvent.pageY);

//                    if (feature.getGeometry().getType().toLowerCase() === "polygon") {
//                        //var str = feature.getProperties().title || "";
//                        if (title) $scope.showTooltip(title, e.originalEvent.pageX, e.originalEvent.pageY);
//                        }
//                    } else {
//                       /* var dataIdx = feature.get("dataIdx");
//                        var title;
//                        var titleProp = "TooltipValue";
//                        if (_this.desc.properties && _this.desc.properties.markerTitleProperty) titleProp = _this.desc.properties.markerTitleProperty;
//                        title = _this.getDataByColumnName(_this.mapData, titleProp || "Name", dataIdx);
//                        if (!title) title = _this.getDataByColumnName(_this.mapData, "Name", dataIdx);
//                        if (!title) title = (_this.mapData.Cols[1].tuples[Math.floor(dataIdx / _this.mapData.Cols[0].tuples.length)].caption || "");
//*/
//                        //         "<br>" + (_this.mapData.Cols[1].tuples[Math.floor(dataIdx / _this.mapData.Cols[0].tuples.length)].title || "");
//
//                        $scope.showTooltip(title, e.originalEvent.pageX, e.originalEvent.pageY);
//                    }
                }

                if (e.dragging) {
                    hideTooltip();
                    return;
                }
                var pixel = _this.map.getEventPixel(e.originalEvent);
                var hit = _this.map.hasFeatureAtPixel(pixel);
                 _this.map.getTarget().style.cursor = hit ? 'pointer' : '';

                _this.featureOverlay.getSource().clear();
                if (feature) {
                    _this.featureOverlay.getSource().addFeature(feature);
                }
            }

            function getTooltipData(name) {
                if (!_this.mapData) return;
                var res = [];
                var item = _this.mapData.Cols[1].tuples.filter(function(el) { return el.caption === name; });
                if (item.length === 0) return;
                item = item[0];
                var idx = _this.mapData.Cols[1].tuples.indexOf(item);
                var l = _this.mapData.Cols[0].tuples.length;
                var tooltip = _this.mapData.Cols[0].tuples.filter(function(el) { return el.caption === "tooltip"; });
                if (tooltip.length === 0) return;
                tooltip = tooltip[0];
                var tooltipIdx = _this.mapData.Cols[0].tuples.indexOf(tooltip);
                res.push({label: "", value: _this.mapData.Data[idx * l + tooltipIdx].split(":")[1] || ""});
                return res;
            }

            function onMapClick(evt) {
                if (dsw.mobile) {
                    if (evt.originalEvent.touches && evt.originalEvent.touches.length !== 1) return;
                }
                var feature = _this.map.forEachFeatureAtPixel(evt.pixel,
                    function (feature, layer) {
                        return feature;
                    });
                if (feature) {

                    hideTooltip();
                    if (dsw.mobile) {
                        if (_this._selectedFeature !== feature) {
                            _this._selectedFeature = feature;
                            onPointerMove(evt);
                            return;
                        }
                    }
                    _this.doDrill(feature.get("path"), feature.get("name") || feature.get("title"), undefined, function() {
                        showPopup(feature);
                    });
                } else {
                    hideTooltip();
                }
                $scope.$apply();

                function showPopup(feature) {
                    var dataIdx = feature.get("dataIdx");
                    var title, content;
                    var contentProp = 'PopupValue';
                    if (_this.desc.properties && _this.desc.properties.markerPopupContentProperty) contentProp = _this.desc.properties.markerPopupContentProperty;
                    if (contentProp) content = _this.getDataByColumnName(_this.mapData, contentProp, dataIdx);
                    else {

                        content = _this.mapData.Cols[1].tuples[Math.floor(dataIdx / _this.mapData.Cols[0].tuples.length)].caption ||
                            _this.mapData.Cols[1].tuples[Math.floor(dataIdx / _this.mapData.Cols[0].tuples.length)].desc || "";
                    }
                    if (!content) {
                        content = _this.getDataByColumnName(_this.mapData, "Name", dataIdx);
                    }
                    if (!content) return;

                    $scope.model.tooltip.content = content;

                    var coord;
                    if (feature.getGeometry().getType().toLowerCase() === "polygon") {
                        evt.pixel[1] += 30;
                        coord = _this.map.getCoordinateFromPixel(evt.pixel);
                        //coord[0] = Math.floor((_this.map.getCoordinateFromPixel(evt.pixel)[0] / 40075016.68) + 0.5) * 20037508.34 * 2;
                        //coord[0] += Math.floor((_this.map.getCoordinateFromPixel(evt.pixel)[0] / 40075016.68) + 0.5) * 20037508.34 * 2;
                    } else {
                        var geometry = feature.getGeometry();
                        coord = geometry.getCoordinates();
                        coord[0] += Math.floor((_this.map.getCoordinateFromPixel(evt.pixel)[0] / 40075016.68) + 0.5) * 20037508.34 * 2;
                    }
                    _this.popup.setPosition(coord);

                    //_this.doDrillFilter(feature.get("path"));

                    /*$(element).popover({
                     'placement': 'top',
                     'html': true,
                     'content': feature.get('name')
                     });*/
                    //$(element).popover('show');
                    $scope.showPopup();

                }
            }

            /*function showTooltip() {
                $scope.model.tooltip.visible = true;
            }*/

            function hideTooltip() {
                $scope.hidePopup();
                //$scope.model.tooltip.visible = false;
            }

            function onResize() {
                if (_this.map) _this.map.updateSize();
            }
        }

        return MapWidget;
    }

    angular.module('widgets')
        .factory('MapWidget', ['Storage', 'CONST', '$timeout', 'Connector', MapWidgetFact]);

})();
