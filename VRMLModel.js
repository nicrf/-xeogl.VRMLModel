/**
 An **VRMLModel** is a {{#crossLink "Model"}}{{/crossLink}} that loads itself from VRML files.

 ## Overview

 * Begins loading as soon as you set its {{#crossLink "VRMLModel/src:property"}}{{/crossLink}} property to the location of an OBJ file.
**/
{

    xeogl.VRMLModel = class xeoglVRMLModel extends xeogl.Model {


        init(cfg) {
            super.init(cfg);
            this._src = null;
            this.src = cfg.src;
        }


        /**
         Path to an VRML file.

         You can set this to a new file path at any time (except while loading), which will cause the VRMLModel to load components from
         the new file (after first destroying any components loaded from a previous file path).

         Fires a {{#crossLink "VRMLModel/loaded:event"}}{{/crossLink}} event when the VRML has loaded.

         @property src
         @type String
         */
        set src(value) {
            if (!value) {
                return;
            }
            if (!xeogl._isString(value)) {
                this.error("Value for 'src' should be a string");
                return;
            }
            if (value === this._src) { // Already loaded this VRMLModel

                /**
                 Fired whenever this VRMLModel has finished loading components from the VRML file
                 specified by {{#crossLink "VRMLModel/src:property"}}{{/crossLink}}.
                 @event loaded
                 */
                this.fire("loaded", true, true);
                return;
            }
            this.clear();
            this._src = value;
            xeogl.VRMLModel.load(this, this._src, this._options);
        }

        get source() {
            return this._src;
        }


        destroy() {
            this.destroyAll();
            super.destroy();
        }


        /**
         * Loads VRML from a URL into a {{#crossLink "Model"}}{{/crossLink}}.
         *
         * @method load
         * @static
         * @param {Model} model Model to load into.
         * @param {String} src Path to VRML file.
         * @param {Function} [ok] Completion callback.
         * @param {Function} [error] Error callback.
         */
        static load(model, src, ok, error) {
			//to be done , zip file with jszip
            var spinner = model.scene.canvas.spinner;
            spinner.processes++;
            load(model, src, function () {
                    spinner.processes--;
                    xeogl.scheduleTask(function () {
                        model.fire("loaded", true, true);
                    });
                    if (ok) {
                        ok();
                    }
                },
                function (msg) {
                    spinner.processes--;
                    model.error(msg);
                    if (error) {
                        error(msg);
                    }
                    /**
                     Fired whenever this VRMLModel fails to load the STL file
                     specified by {{#crossLink "VRMLModel/src:property"}}{{/crossLink}}.
                     @event error
                     @param msg {String} Description of the error
                     */
                    model.fire("error", msg);
                });
        }

        /**
         * Parses OBJ and MTL text strings into a {{#crossLink "Model"}}{{/crossLink}}.
         *
         * @method parse
         * @static
         * @param {Model} model Model to load into.
         * @param {String} vrmlData text string.
         * @param {String} [basePath] Base path for external resources.
         */
        static parse(model, vrmlData, basePath) {
            if (!vrmlData) {
                this.warn("load() param expected: vrmlData");
                return;
            }
            var state = parse(model, vrmlData, null);

            createMeshes(model, state);
            model.src = null;
            model.fire("loaded", true, true);
        }
    };

//--------------------------------------------------------------------------------------------
// Loads VRML
//
// Use https://github.com/bartmcleod/VrmlParser libs
//
// Originally based on the THREE.js VRML loaders: 
//
// https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/OBJLoader.js
// https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/MTLLoader.js
// https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/VRMLLoader.js
// 
//--------------------------------------------------------------------------------------------

    var load = function (model, url, ok) {

        loadFile(url, function (text) {
                var state = parse(text, model, url);
                ok(state);
            },
            function (error) {
                model.error(error);
            });
    };

	function parse(data, model, options) {		

        const WebGLConstants = {
            34963: 'ELEMENT_ARRAY_BUFFER',  //0x8893
            34962: 'ARRAY_BUFFER',          //0x8892
            5123: 'UNSIGNED_SHORT',         //0x1403
            5126: 'FLOAT',                  //0x1406
            4: 'TRIANGLES',                 //0x0004
            35678: 'SAMPLER_2D',            //0x8B5E
            35664: 'FLOAT_VEC2',            //0x8B50
            35665: 'FLOAT_VEC3',            //0x8B51
            35666: 'FLOAT_VEC4',            //0x8B52
            35676: 'FLOAT_MAT4'             //0x8B5C
        };

        const WEBGL_COMPONENT_TYPES = {
            5120: Int8Array,
            5121: Uint8Array,
            5122: Int16Array,
            5123: Uint16Array,
            5125: Uint32Array,
            5126: Float32Array
        };

        const WEBGL_TYPE_SIZES = {
            'SCALAR': 1,
            'VEC2': 2,
            'VEC3': 3,
            'VEC4': 4,
            'MAT2': 4,
            'MAT3': 9,
            'MAT4': 16
        };
		var defines = {};
		
		function addShape(data,parent,model) {			
			var mat = loadMaterial(data,parent,model);
			var geometry = getGeometry(data.geometry);//loadGeometry(data,parent,model);
			if (geometry && mat) {
				return new xeogl.Mesh({
					geometry:geometry,
					material:mat
				});	
			} else if (geometry) {
				return new xeogl.Mesh({
					geometry:geometry
				});
			}
		}
		
		function loadGeometry(data,parent,model) {		
			var geometrysInfo = data.geometry;
			if (geometrysInfo) {
				if (Array.isArray(geometrysInfo)){
					// group?
					var group = new xeogl.Group();
					for (var i = 0, len = materialsInfo.length; i < len; i++) {
						var geometry = getGeometry(geometrysInfo[i]);
						group.addChild(geometry);
						model._addComponent(geometry);	
					}
					return group;							
				} else {
					return getGeometry(geometrysInfo);
				}
			}			
		}
		
		function getGeometry(data) {
			console.log("Shape as : "+ data.node);
			if ( data.node === 'Box' ) {
				var s = data.size;
				return new xeogl.BoxGeometry({ // Half-size on each axis; BoxGeometry is actually two units big on each side.
				   xSize: s.x/2, 
				   ySize: s.y/2,
				   zSize: s.z/2
				});
			} else if (data.node === 'Cylinder') { //data.radius, data.radius, data.height
				return new xeogl.CylinderGeometry({
					radiusTop: data.radius,
					radiusBottom: data.radius,
					height:  data.height
				});
			} else if (data.node === 'Cone') {
				return new xeogl.CylinderGeometry({
					radiusTop: data.topRadius,
					radiusBottom: data.bottomRadius,
					height:  data.height
				});				
			} else if (data.node === 'Sphere') {
				return new xeogl.SphereGeometry({
					radius: data.radius,
				});				
			} else if (data.node === 'PointSet') {	//To be test
				var positions = [];
				var indices = []; 
				if (data.coord) {
					for (var i = 0; i < data.coord.point.length; i ++ ) {
						positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
					}
					indices = data.coordIndex.toString().split(",");
					return new xeogl.Geometry({
						primitive: "points",
						positions: positions,
						indices: indices
					});
				}
			} else if (data.node === 'IndexedLineSet') {	//To be test
				var positions = [];
				var indices = []; 
				if (data.coord) {
					for (var i = 0; i < data.coord.point.length; i ++ ) {
						positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
					}
					indices = data.coordIndex.toString().split(",");
					return new xeogl.Geometry({
						primitive: "lines",
						positions: positions,
						indices:  indices
					});
				}
			} else if (data.node === 'IndexedFaceSet') {	//To be done
				var positions = [];
				var indices = [];
				var faces = [];
				if (data.coord) {

					for (var i = 0; i < data.coord.point.length; i ++ ) {
						positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
					}
					/*for (var i = 0; i < data.coordIndex.length; i ++ ) {
						indices.push(data.coordIndex[i].join(", "));
					}*/
					if (data.ccw && data.ccw === false)
						console.error("CCW")
					var skip = 0;
					for ( var i = 0, j = data.coordIndex.length; i < j; i ++ ) {
						var indexes = data.coordIndex[i];
						skip = 0;
						while (indexes.length >= 3 && skip < (indexes.length - 2)) {
							var a = indexes[0];
							var b = indexes[skip + (data.ccw ? 1 : 2)];
							var c = indexes[skip + (data.ccw ? 2 : 1)];
							skip++;
							faces.push(a, b, c);
						}
					}
					indices = faces.toString().split(",");
					var creaseAngle = data.creaseAngle ? data.creaseAngle : 2;
					return new xeogl.Geometry({
						primitive: "triangles",
						positions: new Float32Array(positions),
						indices: new Uint16Array(indices),
						autoVertexNormals :true,
						edgeThreshold:2
					});
				}
				//return parseIndexedFaceSet(data);
			}
		}		


		function loadMaterial(data,parent,model) {
			var appearance = data.appearance; //child??
			if (appearance) {
				var materialsInfo = appearance.material;
				var material;
				if (materialsInfo) {
					if (Array.isArray(materialsInfo)){
						for (var i = 0, len = materialsInfo.length; i < len; i++) {
							material = loadMaterialColorize(materialInfo[i]); //As option? is not use specularColor						
							//parent.addChild(material);
							model._addComponent(material);
						}
					} else {
						return loadMaterialColorize(materialsInfo); //As option? is not use specularColor							
					}
				}
			}			
			//ImageTexture tbd
		}
		
		function loadMaterialColorize(materialInfo) {
			var mat = new xeogl.LambertMaterial();					
            if (materialInfo.diffuseColor){
			//	mat.ambient =   [materialInfo.diffuseColor.x,materialInfo.diffuseColor.y, materialInfo.diffuseColor.z]
				mat.color =   [materialInfo.diffuseColor.x,materialInfo.diffuseColor.y, materialInfo.diffuseColor.z]
			}
			
			if (materialInfo.emissiveColor){
				mat.emissive =   [materialInfo.emissiveColor.x,materialInfo.emissiveColor.y, materialInfo.emissiveColor.z]
			}
			
			if (materialInfo.transparency) {
				mat.alpha = materialInfo.transparency;
			}
			
			if ( materialInfo.string ) {
				defines[ materialInfo.string ] = mat;
			}	
			return mat;
        }

		function parseNode(data,parent,model) {
			console.log("Parse an node " + data.node);
			if (data.name) {
				console.log("Parse an node " + data.name);
			}
			var object = parent;
			switch(data.node) {
				case 'Transform' :
				case 'Group' :
					object = new xeogl.Group();
					if (data.translation) {
						var t = data.translation;
						object.position = [ t.x, t.y, t.z ];
					}
					if (data.rotation) {
						var r = data.rotation;
						object.quaternion= [ r.x, r.y, r.z , r.w ];
					}
					if (data.scale) {
						var s = data.scale;
						object.scale = [ s.x, s.y, s.z ];
					}
					if (data.name) {
						object.id = data.name;
						defines[ object.id ] = object;
					}
					parent.addChild(object); // Don't automatically inherit properties
					model._addComponent(object);
					break;
				case 'Shape':
					shape = addShape(data,parent,model);
					if (shape) {
						if (data.name) {
							shape.id = data.name;
							defines[ shape.id ] = shape;
						}
						parent.addChild(shape);
						model._addComponent(shape);
					}
					break;
				case 'Light':
				case 'AmbientLight':
				case 'PointLight':
				case 'Background':
				case "OrientationInterpolator":
				case "PositionInterpolator":
				case "Viewpoint":
				case "NavigationInfo":
				case "Text":
				case "Inline":
				case "Switch":
				case "TimeSensor":
				case "TouchSensor":
				default:
					console.warn(data.node + " type node is not implemented")
					break;
				case undefined:
					console.error("Node is not defined")
					break;
			}
			if (data.children) {
				for ( var i = 0, l = data.children.length; i < l; i ++ ) {
					parseNode( data.children[ i ], object,model );
				}
			}
		}

		function parseNodeDefinition(data,model) {
			if (data.node!= 'Transform' && data.node!= 'Group')
				return;

			var object = new xeogl.Group();
			if (data.translation) {
				var t = data.translation;
				object.position = [t.x,t.y,t.z]
			}

			if (data.rotation) {
				var r = data.rotation;
				object.quaternion= [ r.x, r.y, r.z , r.w ];
			}
			if (data.scale) {
				var s = data.scale;
				object.scale = [ s.x, s.y, s.z ];
			}
			if (data.name) {
				object.id = data.name;
				defines[ object.id ] = object;
			}

			for (var i = 0, l = data.children.length; i < l; i ++ ) {
				switch(data.children[ i ].node) {
					case 'Transform' :
					case 'Group' :
						//TBD
						break;
					case 'Shape':
						var shape = addShape(data.children[ i ]);
						if (shape) {
							if (data.children[ i ].name) {
								shape.id = data.children[ i ].name;
								defines[ shape.id ] = shape;
							}
							object.addChild(shape, false);
							//model._addComponent(shape);
						}
						break;
				}
			}
			model._addComponent(object);
		}

		// Action
		model.clear();
		var tree = vrmlParser.parse(data);
		//var lines = parseLines(data);
		console.log(tree);
		for ( var i = 0, l = tree.length; i < l; i ++ ) {
			parseNode(tree[i],model,model);
		}
		console.log(defines);
		/*for (node in tree.nodeDefinitions){
			parseNodeDefinition(node,model);
		}*/
		//for
		/*jQuery.each(tree.nodeDefinitions, function() {
			console.log(this.name);
			parseNodeDefinition(this,model);
		});*/
		//forEach

       // return ;

    }



    function loadFile(url, ok, err) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.addEventListener('load', function (event) {
            var response = event.target.response;
            if (this.status === 200) {
                if (ok) {
                    ok(response);
                }
            } else if (this.status === 0) {
                // Some browsers return HTTP Status 0 when using non-http protocol
                // e.g. 'file://' or 'data://'. Handle as success.
                console.warn('loadFile: HTTP Status 0 received.');
                if (ok) {
                    ok(response);
                }
            } else {
                if (err) {
                    err(event);
                }
            }
        }, false);

        request.addEventListener('error', function (event) {
            if (err) {
                err(event);
            }
        }, false);
        request.send(null);
    }
}