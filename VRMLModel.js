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
            this.debug = false;
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
// Build for EPLAN P8 Export
// By Nicolas Fournier (nic_rf)
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
		var debug = options.debug ? options.debug : false;
		var showInfo = options.showInfo ? options.showInfo : true;
		var defines = {};
		var totalNode = 0;
		var doneNode = 0;
		
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
		
		function addShape(data,parent) {	//model?		
			var mat = loadMaterial(data,parent);
			var geometry = buildGeometry(data.geometry);//loadGeometry(data,parent,model);
			//model._addComponent(mat)
			var mesh = new xeogl.Mesh({
					geometry:geometry,
					material: mat
			});
			return mesh;
		}
		
		function loadGeometry(data,parent) {		
			var geometrysInfo = data.geometry;
			if (geometrysInfo) {
				if (Array.isArray(geometrysInfo)){
					// group?
					/*var group = new xeogl.Group();
					for (var i = 0, len = materialsInfo.length; i < len; i++) {
						var geometry = buildGeometry(geometrysInfo[i]);
						group.addChild(geometry);
						model._addComponent(geometry);	
					}
					return group;	*/						
				} else {
					return buildGeometry(geometrysInfo);
				}
			}			
		}
		
		function buildGeometry(data) {
			if (this.debug === true ) {
				console.log("Shape as : "+ data.node);
			}
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
			} else if (data.node === 'IndexedLineSet') {	//To be check , each array need to be a line system
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
				var uvs = [];				
				var faces = [];
				var face_uvs=[[0,0],[1,0],[1,1],[0,1]];
				if (data.coord) {
					// positions
					if ( data.texCoord) {
						uvs = data.texCoord.point;
					}
					for (var i = 0; i < data.coord.point.length; i ++ ) {
						if (!data.texCoord) {
							uvs.push(data.coord.point[i]);
						}
						positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
					}
				}
				if (data.coordIndex && data.coordIndex.length && data.coordIndex.length>0) {
					//Bug when we got -1 coordIndex to separate indices for each polygon - To be done - But EPLAN do not created face with multiple polygone
					// indices from faces		  
					for (var f = 0; f < data.coordIndex.length; f++) {
					  for(var j = 0; j < data.coordIndex[f].length; j++) {
						uvs=uvs.concat(face_uvs[j]);
					  }
					  for (i = 0; i < data.coordIndex[f].length - 2; i++) {
						  indices.push(data.coordIndex[f][0], data.coordIndex[f][i + 2], data.coordIndex[f][i + 1]);
					  }
					}
				}
				var normals = [];
				positions = new Float32Array(positions);
				indices = new Uint16Array(indices)				
				//Build Normals
				normals = xeogl.math.buildNormals(positions,indices,normals);				
				var result =  xeogl.math.mergeVertices(positions, normals, null, indices)
				result.normals = xeogl.math.buildNormals(result.positions,result.indices,result.normals);
				var creaseAngle = data.creaseAngle ? data.creaseAngle : 2;
				/*if (result.positions && result.positions.length && result.positions.length > 0) {					
					result = xeogl.math.faceToVertexNormals(result.positions, result.normals, {smoothNormalsAngleThreshold : creaseAngle}); //Not working?
				}*/			
				return new xeogl.Geometry({
						primitive: "triangles",
						positions: result.positions,
						indices: result.indices,
						normals: result.normals,
						//autoVertexNormals :true,
					});
			}
		}		


		function loadMaterial(data,parent) {
			var appearance = data.appearance; //child??
			if (appearance) {
				var materialsInfo = appearance.material;
				var material;
				if (materialsInfo) {
					/*if (Array.isArray(materialsInfo)){
						for (var i = 0, len = materialsInfo.length; i < len; i++) {
							material = loadMaterialColorize(materialInfo[i]); //As option? is not use specularColor						
							//parent.addChild(material);
							model._addComponent(material);
						}
					} else {*/
						material =  loadMaterialColorize(materialsInfo); //As option? is not use specularColor							
						//model._addComponent(material);
						return material;
					//}
				}
			}			
			//ImageTexture tbd
		}
		
		function loadMaterialColorize(materialInfo) {
			var mat = new xeogl.LambertMaterial();					
            if (materialInfo.diffuseColor){
				mat.ambient =   [materialInfo.diffuseColor.x,materialInfo.diffuseColor.y, materialInfo.diffuseColor.z]
				mat.color =   [materialInfo.diffuseColor.x,materialInfo.diffuseColor.y, materialInfo.diffuseColor.z]
			}
			
			if (materialInfo.emissiveColor){
				mat.emissive =   [materialInfo.emissiveColor.x,materialInfo.emissiveColor.y, materialInfo.emissiveColor.z]
			}
			
			if (materialInfo.transparency) {
				mat.alpha = materialInfo.transparency;
			}
			return mat;
        }

		function parseNode(data,parent) {
			var name = "";	
			if (data.name) {
				name = data.name;	
			} else if (data.node){
				name = data.node;
			}
			if (this.debug === true ) {
				console.log("Parse an node " + data.node);
				if (name) {
					console.log("Parse an node " + data.name);
				}
			}
			var object = parent;
			switch(data.node) {
				case 'Transform' :
				case 'Group' :
					object = new xeogl.Group();									
					if (data.rotation) {
						var r = data.rotation;
						object.matrix= xeogl.math.rotationMat4v(r.radians,[ r.x , r.y, r.z ]);
					}					
					if (data.translation) {
						var t = data.translation;
						object.position = [ t.x, t.y, t.z ];
					}
					if (data.scale) {
						var s = data.scale;
						object.scale = [ s.x, s.y, s.z ];
					}
					break;
				case 'Shape':
					object = addShape(data,parent);
					break;
				case 'DirectionalLight':	//ambientIntensity 
					if (data.on) {
						object = new xeogl.DirLight({
						   dir: [data.direction.x, data.direction.y, data.direction.z],
						});						
						if (data.color) {
							object.color = [data.color.x, data.color.y, data.color.z];
						}	
						if (data.intensity) {
							object.intensity = data.intensity;
						}
					}
					break;
				case 'PointLight':
					if (data.on) {
						object = new xeogl.PointLight({
						   pos: [data.location.x, data.location.y, data.location.z],
						});						
						if (data.color) {
							object.color = [data.color.x, data.color.y, data.color.z];
						}	
						if (data.intensity) {
							object.intensity = data.intensity;
						}					
					}
					break;
				case 'IndexedFaceSet':
				case 'IndexedLineSet':
				case 'PointSet':
				case 'Sphere':
				case 'Cone':
				case 'Cylinder':
				case 'Box':
					object = buildGeometry(data.geometry,parent);
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
			if (parent != object) {
				object.id = name;
				defines[ object.id ] = object;
				model._addComponent(object);
				if (parent !== undefined) {
					parent.addChild(object);
				}
			}
			if (data.children) {
				for ( var i = 0, l = data.children.length; i < l; i ++ ) {
					parseNode( data.children[ i ], object );
				}
			}
			doneNode++;
			if (this.showInfo) {
				console.info("Node complete %d", this.doneNode/this.totalNode);
			}
		}
		
		function countNode (obj) {
			var count = 0;
			for (var property in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, property)) {
					count++;
				}
			}
			return count;
		}


		// Action
		model.clear();
		if (this.debug === true ) {
			console.log("Parse the file");
		}
		var tree = vrmlParser.parse(data);
		if (this.debug === true ) {
			console.log(tree);
		}
		this.totalNode = countNode(tree.nodeDefinitions);
		for ( var i = 0, l = tree.length; i < l; i ++ ) {
			parseNode(tree[i],model);
		}
		if (this.debug === true ) {
			console.log(defines);
		}
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