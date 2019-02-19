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
				
				return parseIndexedFaceSet(data);				
			}
		}		

		function parseIndexedFaceSet(node){
			var indexes, uvIndexes, uvs;
			var vec;
			var vertices = [];
			var normals = [];
			var faces = [];
			var faceVertexUvs = [];
			if ( data.texCoord) {
				uvs = node.texCoord.point;
			}

			if ( node.coord) {
				if ( ! uvs ) {
					uvs = node.coord.point;
				}
				for ( var k = 0, l = node.coord.point.length; k < l; k ++ ) {
					var point = node.coord.point[ k ];
					//vec = [point.x, point.y, point.z];
					vertices.push(point.x, point.y, point.z);
					normals.push(0,0,0);
				}
			}

			var skip = 0;
			// some shapes only have vertices for use in other shapes
			if ( node.coordIndex ) {
				// read this: http://math.hws.edu/eck/cs424/notes2013/16_Threejs_Advanced.html
				for ( var i = 0, j = node.coordIndex.length; i < j; i ++ ) {
					indexes = node.coordIndex[ i ];
					if ( node.texCoordIndex && node.texCoordIndex.length && node.texCoordIndex.length>0) {
						uvIndexes = node.texCoordIndex[ i ];
					} else {
						// default texture coord index
						uvIndexes = indexes;
					}
					// vrml supports multipoint indexed face sets (more then 3 vertices). You must calculate the composing triangles here
					skip = 0;
					// @todo: see if your can support squares, because they are possible in THREE (if you do, duplicator must also support them!!)
					// Face3 only works with triangles, but IndexedFaceSet allows shapes with polygons: triangulate them
					while ( indexes.length >= 3 && skip < ( indexes.length - 2 ) ) {
						var a = indexes[ 0 ];
						var b = indexes[ skip + (node.ccw ? 1 : 2) ];
						var c = indexes[ skip + (node.ccw ? 2 : 1) ];
						var face = [
							a,
							b,
							c,
							null // normal, will be added later
							// todo: pass in the color, if a color index is present
						];
						//normals.push(math.norm(math.cross([b-a],[c-a])));
						//this.log(face);
						// @todo: this code might have to move till after vertices have been duplicated for sharp edge rendering
						if ( uvs && uvIndexes ) {
							faceVertexUvs.push(								
									uvs[ uvIndexes[ 0 ] ].x,
									uvs[ uvIndexes[ 0 ] ].y							
								,								
									uvs[ uvIndexes[ skip + (node.ccw ? 1 : 2) ] ].x,
									uvs[ uvIndexes[ skip + (node.ccw ? 1 : 2) ] ].y
								,								
									uvs[ uvIndexes[ skip + (node.ccw ? 2 : 1) ] ].x,
									uvs[ uvIndexes[ skip + (node.ccw ? 2 : 1) ] ].y								
							);
						} else {
							console.log('Missing either uvs or indexes');
						}
						skip ++;
						faces.push(a,b,c);

					}

				}

			}

			var creaseAngle = node.creaseAngle ? node.creaseAngle : false;

			// if no creaseAngle, the VRML author probably wasn't intersted in smooth rendering, so don't!
			if ( false !== creaseAngle ) {
				//smooth.smooth(object, creaseAngle);
				//xeogl.math.faceToVertexNormals(positions, creaseAngle);
			} else {
				// only compute face normals, perform no smoothing
				//var cb =  new Float32Array([0,0,0]), ab =  new Float32Array([0,0,0]);
				//Flat shading normals
				//For each triangle ABC
				/*for ( var k = 0, l = faces.length; k < l; k +=1 ) {
					var face = faces[ k ];
					var vA = [vertices[ face ], vertices[ face + 1 ] , vertices[ face + 2 ]];
					var vB = [vertices[ face ], vertices[ face + 1 ] , vertices[ face + 2 ]]
					var vC = [vertices[ face ], vertices[ face + 1 ] , vertices[ face + 2 ]]; //cross = [ a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1 ]
					var n = math.cross([1, 1, 0],   [0, 1, 1]) 
				}*/	
			}			
			console.log(vertices);
			console.log(faces);
			console.log(faceVertexUvs);
			console.log(indexes);
			if (indexes && indexes!= -1)
				indices = new Uint16Array(indexes);		

			
			if (indexes && indexes != -1)
			return new xeogl.Geometry(model, {
				primitive: "triangles",
				quantized: false, // Not compressed
				positions: new Float32Array(vertices),
				normals: new Float32Array(uvs),
				//normals: normals && normals.length > 0 ? normals : null,
				autoNormals: true, //!normals || normals.length === 0,
				uv: new Float32Array(faceVertexUvs),
				autoVertexNormals: true,
				//colors: colors,
				indices: new Uint16Array(faces)
			});
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
							parent.addChild(material);
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
						//object.id = data.name;
						//defines[ object.id ] = object;
					}
					parent.addChild(object, false); // Don't automatically inherit properties
					model._addComponent(object);
					break;
				case 'Shape':
					object = addShape(data,parent,model);
					if (object) {
						parent.addChild(object, false);
						model._addComponent(object);
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
			}
			if (data.children) {
				for ( var i = 0, l = data.children.length; i < l; i ++ ) {
					parseNode( data.children[ i ], object,model );
				}
			}
		}

		// Action
		model.clear();
		var tree = vrmlParser.parse(data);
		//var lines = parseLines(data);
		console.log(tree);
		for ( var i = 0, l = tree.length; i < l; i ++ ) {
			parseNode(tree[i],model,model);
		}
		/*jQuery.each(tree.nodeDefinitions, function() {
			console.log(this.name);
			parseNode(this,model,model);
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