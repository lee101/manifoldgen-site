(()=>{var f7="179";var j7=0,F9=1,y7=2;var L9=1,v7=2,Z5=3,R5=0,m1=1,u1=2,j5=0,Q6=1,P9=2,V9=3,z9=4,b7=5,I8=100,p7=101,x7=102,g7=103,l7=104,d7=200,m7=201,u7=202,c7=203,n7=204,s7=205,o7=206,i7=207,a7=208,r7=209,t7=210,e7=211,$Q=212,JQ=213,QQ=214,$$=0,J$=1,C8=2,M6=3,Q$=4,M$=5,H$=6,K$=7,MQ=0,HQ=1,KQ=2,z5=0,WQ=1,kQ=2,EQ=3,wQ=4,ZQ=5,RQ=6,UQ=7;var _8=301,i5=302,W$=303,k$=304,H6=306,YQ=1000,NQ=1001,XQ=1002,c1=1003,GQ=1004;var K6=1005;var a5=1006,E$=1007;var A8=1008;var U5=1009,DQ=1010,qQ=1011,W6=1012,B9=1013,S8=1014,y5=1015,k6=1016,I9=1017,C9=1018,T8=1020,OQ=35902,FQ=1021,LQ=1022,e1=1023,w$=1026,E6=1027,PQ=1028,_9=1029,VQ=1030,A9=1031;var S9=1033,Z$=33776,R$=33777,U$=33778,Y$=33779,T9=35840,h9=35841,f9=35842,j9=35843,y9=36196,v9=37492,b9=37496,p9=37808,x9=37809,g9=37810,l9=37811,d9=37812,m9=37813,u9=37814,c9=37815,n9=37816,s9=37817,o9=37818,i9=37819,a9=37820,r9=37821,N$=36492,t9=36494,e9=36495,zQ=36283,$J=36284,JJ=36285,QJ=36286;var BQ=3201;var IQ=0,CQ=1,r5="",_Q="srgb",w6="srgb-linear",MJ="linear",K1="srgb";var AQ=512,SQ=513,TQ=514,HJ=515,hQ=516,fQ=517,jQ=518,yQ=519;var KJ="300 es",WJ=2000;class v5{addEventListener($,J){if(this._listeners===void 0)this._listeners={};let Q=this._listeners;if(Q[$]===void 0)Q[$]=[];if(Q[$].indexOf(J)===-1)Q[$].push(J)}hasEventListener($,J){let Q=this._listeners;if(Q===void 0)return!1;return Q[$]!==void 0&&Q[$].indexOf(J)!==-1}removeEventListener($,J){let Q=this._listeners;if(Q===void 0)return;let M=Q[$];if(M!==void 0){let H=M.indexOf(J);if(H!==-1)M.splice(H,1)}}dispatchEvent($){let J=this._listeners;if(J===void 0)return;let Q=J[$.type];if(Q!==void 0){$.target=this;let M=Q.slice(0);for(let H=0,K=M.length;H<K;H++)M[H].call(this,$);$.target=null}}}var B1=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var a$=Math.PI/180,r6=180/Math.PI;function Z6(){let $=Math.random()*4294967295|0,J=Math.random()*4294967295|0,Q=Math.random()*4294967295|0,M=Math.random()*4294967295|0;return(B1[$&255]+B1[$>>8&255]+B1[$>>16&255]+B1[$>>24&255]+"-"+B1[J&255]+B1[J>>8&255]+"-"+B1[J>>16&15|64]+B1[J>>24&255]+"-"+B1[Q&63|128]+B1[Q>>8&255]+"-"+B1[Q>>16&255]+B1[Q>>24&255]+B1[M&255]+B1[M>>8&255]+B1[M>>16&255]+B1[M>>24&255]).toLowerCase()}function n0($,J,Q){return Math.max(J,Math.min(Q,$))}function UH($,J){return($%J+J)%J}function r$($,J,Q){return(1-Q)*$+Q*J}function i8($,J){switch(J.constructor){case Float32Array:return $;case Uint32Array:return $/4294967295;case Uint16Array:return $/65535;case Uint8Array:return $/255;case Int32Array:return Math.max($/2147483647,-1);case Int16Array:return Math.max($/32767,-1);case Int8Array:return Math.max($/127,-1);default:throw Error("Invalid component type.")}}function h1($,J){switch(J.constructor){case Float32Array:return $;case Uint32Array:return Math.round($*4294967295);case Uint16Array:return Math.round($*65535);case Uint8Array:return Math.round($*255);case Int32Array:return Math.round($*2147483647);case Int16Array:return Math.round($*32767);case Int8Array:return Math.round($*127);default:throw Error("Invalid component type.")}}class $1{constructor($=0,J=0){$1.prototype.isVector2=!0,this.x=$,this.y=J}get width(){return this.x}set width($){this.x=$}get height(){return this.y}set height($){this.y=$}set($,J){return this.x=$,this.y=J,this}setScalar($){return this.x=$,this.y=$,this}setX($){return this.x=$,this}setY($){return this.y=$,this}setComponent($,J){switch($){case 0:this.x=J;break;case 1:this.y=J;break;default:throw Error("index is out of range: "+$)}return this}getComponent($){switch($){case 0:return this.x;case 1:return this.y;default:throw Error("index is out of range: "+$)}}clone(){return new this.constructor(this.x,this.y)}copy($){return this.x=$.x,this.y=$.y,this}add($){return this.x+=$.x,this.y+=$.y,this}addScalar($){return this.x+=$,this.y+=$,this}addVectors($,J){return this.x=$.x+J.x,this.y=$.y+J.y,this}addScaledVector($,J){return this.x+=$.x*J,this.y+=$.y*J,this}sub($){return this.x-=$.x,this.y-=$.y,this}subScalar($){return this.x-=$,this.y-=$,this}subVectors($,J){return this.x=$.x-J.x,this.y=$.y-J.y,this}multiply($){return this.x*=$.x,this.y*=$.y,this}multiplyScalar($){return this.x*=$,this.y*=$,this}divide($){return this.x/=$.x,this.y/=$.y,this}divideScalar($){return this.multiplyScalar(1/$)}applyMatrix3($){let J=this.x,Q=this.y,M=$.elements;return this.x=M[0]*J+M[3]*Q+M[6],this.y=M[1]*J+M[4]*Q+M[7],this}min($){return this.x=Math.min(this.x,$.x),this.y=Math.min(this.y,$.y),this}max($){return this.x=Math.max(this.x,$.x),this.y=Math.max(this.y,$.y),this}clamp($,J){return this.x=n0(this.x,$.x,J.x),this.y=n0(this.y,$.y,J.y),this}clampScalar($,J){return this.x=n0(this.x,$,J),this.y=n0(this.y,$,J),this}clampLength($,J){let Q=this.length();return this.divideScalar(Q||1).multiplyScalar(n0(Q,$,J))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot($){return this.x*$.x+this.y*$.y}cross($){return this.x*$.y-this.y*$.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo($){let J=Math.sqrt(this.lengthSq()*$.lengthSq());if(J===0)return Math.PI/2;let Q=this.dot($)/J;return Math.acos(n0(Q,-1,1))}distanceTo($){return Math.sqrt(this.distanceToSquared($))}distanceToSquared($){let J=this.x-$.x,Q=this.y-$.y;return J*J+Q*Q}manhattanDistanceTo($){return Math.abs(this.x-$.x)+Math.abs(this.y-$.y)}setLength($){return this.normalize().multiplyScalar($)}lerp($,J){return this.x+=($.x-this.x)*J,this.y+=($.y-this.y)*J,this}lerpVectors($,J,Q){return this.x=$.x+(J.x-$.x)*Q,this.y=$.y+(J.y-$.y)*Q,this}equals($){return $.x===this.x&&$.y===this.y}fromArray($,J=0){return this.x=$[J],this.y=$[J+1],this}toArray($=[],J=0){return $[J]=this.x,$[J+1]=this.y,$}fromBufferAttribute($,J){return this.x=$.getX(J),this.y=$.getY(J),this}rotateAround($,J){let Q=Math.cos(J),M=Math.sin(J),H=this.x-$.x,K=this.y-$.y;return this.x=H*Q-K*M+$.x,this.y=H*M+K*Q+$.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class m0{constructor($=0,J=0,Q=0,M=1){this.isQuaternion=!0,this._x=$,this._y=J,this._z=Q,this._w=M}static slerpFlat($,J,Q,M,H,K,W){let k=Q[M+0],E=Q[M+1],w=Q[M+2],R=Q[M+3],Z=H[K+0],U=H[K+1],X=H[K+2],G=H[K+3];if(W===0){$[J+0]=k,$[J+1]=E,$[J+2]=w,$[J+3]=R;return}if(W===1){$[J+0]=Z,$[J+1]=U,$[J+2]=X,$[J+3]=G;return}if(R!==G||k!==Z||E!==U||w!==X){let q=1-W,Y=k*Z+E*U+w*X+R*G,N=Y>=0?1:-1,B=1-Y*Y;if(B>Number.EPSILON){let V=Math.sqrt(B),h=Math.atan2(V,Y*N);q=Math.sin(q*h)/V,W=Math.sin(W*h)/V}let D=W*N;if(k=k*q+Z*D,E=E*q+U*D,w=w*q+X*D,R=R*q+G*D,q===1-W){let V=1/Math.sqrt(k*k+E*E+w*w+R*R);k*=V,E*=V,w*=V,R*=V}}$[J]=k,$[J+1]=E,$[J+2]=w,$[J+3]=R}static multiplyQuaternionsFlat($,J,Q,M,H,K){let W=Q[M],k=Q[M+1],E=Q[M+2],w=Q[M+3],R=H[K],Z=H[K+1],U=H[K+2],X=H[K+3];return $[J]=W*X+w*R+k*U-E*Z,$[J+1]=k*X+w*Z+E*R-W*U,$[J+2]=E*X+w*U+W*Z-k*R,$[J+3]=w*X-W*R-k*Z-E*U,$}get x(){return this._x}set x($){this._x=$,this._onChangeCallback()}get y(){return this._y}set y($){this._y=$,this._onChangeCallback()}get z(){return this._z}set z($){this._z=$,this._onChangeCallback()}get w(){return this._w}set w($){this._w=$,this._onChangeCallback()}set($,J,Q,M){return this._x=$,this._y=J,this._z=Q,this._w=M,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy($){return this._x=$.x,this._y=$.y,this._z=$.z,this._w=$.w,this._onChangeCallback(),this}setFromEuler($,J=!0){let{_x:Q,_y:M,_z:H,_order:K}=$,W=Math.cos,k=Math.sin,E=W(Q/2),w=W(M/2),R=W(H/2),Z=k(Q/2),U=k(M/2),X=k(H/2);switch(K){case"XYZ":this._x=Z*w*R+E*U*X,this._y=E*U*R-Z*w*X,this._z=E*w*X+Z*U*R,this._w=E*w*R-Z*U*X;break;case"YXZ":this._x=Z*w*R+E*U*X,this._y=E*U*R-Z*w*X,this._z=E*w*X-Z*U*R,this._w=E*w*R+Z*U*X;break;case"ZXY":this._x=Z*w*R-E*U*X,this._y=E*U*R+Z*w*X,this._z=E*w*X+Z*U*R,this._w=E*w*R-Z*U*X;break;case"ZYX":this._x=Z*w*R-E*U*X,this._y=E*U*R+Z*w*X,this._z=E*w*X-Z*U*R,this._w=E*w*R+Z*U*X;break;case"YZX":this._x=Z*w*R+E*U*X,this._y=E*U*R+Z*w*X,this._z=E*w*X-Z*U*R,this._w=E*w*R-Z*U*X;break;case"XZY":this._x=Z*w*R-E*U*X,this._y=E*U*R-Z*w*X,this._z=E*w*X+Z*U*R,this._w=E*w*R+Z*U*X;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+K)}if(J===!0)this._onChangeCallback();return this}setFromAxisAngle($,J){let Q=J/2,M=Math.sin(Q);return this._x=$.x*M,this._y=$.y*M,this._z=$.z*M,this._w=Math.cos(Q),this._onChangeCallback(),this}setFromRotationMatrix($){let J=$.elements,Q=J[0],M=J[4],H=J[8],K=J[1],W=J[5],k=J[9],E=J[2],w=J[6],R=J[10],Z=Q+W+R;if(Z>0){let U=0.5/Math.sqrt(Z+1);this._w=0.25/U,this._x=(w-k)*U,this._y=(H-E)*U,this._z=(K-M)*U}else if(Q>W&&Q>R){let U=2*Math.sqrt(1+Q-W-R);this._w=(w-k)/U,this._x=0.25*U,this._y=(M+K)/U,this._z=(H+E)/U}else if(W>R){let U=2*Math.sqrt(1+W-Q-R);this._w=(H-E)/U,this._x=(M+K)/U,this._y=0.25*U,this._z=(k+w)/U}else{let U=2*Math.sqrt(1+R-Q-W);this._w=(K-M)/U,this._x=(H+E)/U,this._y=(k+w)/U,this._z=0.25*U}return this._onChangeCallback(),this}setFromUnitVectors($,J){let Q=$.dot(J)+1;if(Q<0.00000001)if(Q=0,Math.abs($.x)>Math.abs($.z))this._x=-$.y,this._y=$.x,this._z=0,this._w=Q;else this._x=0,this._y=-$.z,this._z=$.y,this._w=Q;else this._x=$.y*J.z-$.z*J.y,this._y=$.z*J.x-$.x*J.z,this._z=$.x*J.y-$.y*J.x,this._w=Q;return this.normalize()}angleTo($){return 2*Math.acos(Math.abs(n0(this.dot($),-1,1)))}rotateTowards($,J){let Q=this.angleTo($);if(Q===0)return this;let M=Math.min(1,J/Q);return this.slerp($,M),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot($){return this._x*$._x+this._y*$._y+this._z*$._z+this._w*$._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let $=this.length();if($===0)this._x=0,this._y=0,this._z=0,this._w=1;else $=1/$,this._x=this._x*$,this._y=this._y*$,this._z=this._z*$,this._w=this._w*$;return this._onChangeCallback(),this}multiply($){return this.multiplyQuaternions(this,$)}premultiply($){return this.multiplyQuaternions($,this)}multiplyQuaternions($,J){let{_x:Q,_y:M,_z:H,_w:K}=$,W=J._x,k=J._y,E=J._z,w=J._w;return this._x=Q*w+K*W+M*E-H*k,this._y=M*w+K*k+H*W-Q*E,this._z=H*w+K*E+Q*k-M*W,this._w=K*w-Q*W-M*k-H*E,this._onChangeCallback(),this}slerp($,J){if(J===0)return this;if(J===1)return this.copy($);let Q=this._x,M=this._y,H=this._z,K=this._w,W=K*$._w+Q*$._x+M*$._y+H*$._z;if(W<0)this._w=-$._w,this._x=-$._x,this._y=-$._y,this._z=-$._z,W=-W;else this.copy($);if(W>=1)return this._w=K,this._x=Q,this._y=M,this._z=H,this;let k=1-W*W;if(k<=Number.EPSILON){let U=1-J;return this._w=U*K+J*this._w,this._x=U*Q+J*this._x,this._y=U*M+J*this._y,this._z=U*H+J*this._z,this.normalize(),this}let E=Math.sqrt(k),w=Math.atan2(E,W),R=Math.sin((1-J)*w)/E,Z=Math.sin(J*w)/E;return this._w=K*R+this._w*Z,this._x=Q*R+this._x*Z,this._y=M*R+this._y*Z,this._z=H*R+this._z*Z,this._onChangeCallback(),this}slerpQuaternions($,J,Q){return this.copy($).slerp(J,Q)}random(){let $=2*Math.PI*Math.random(),J=2*Math.PI*Math.random(),Q=Math.random(),M=Math.sqrt(1-Q),H=Math.sqrt(Q);return this.set(M*Math.sin($),M*Math.cos($),H*Math.sin(J),H*Math.cos(J))}equals($){return $._x===this._x&&$._y===this._y&&$._z===this._z&&$._w===this._w}fromArray($,J=0){return this._x=$[J],this._y=$[J+1],this._z=$[J+2],this._w=$[J+3],this._onChangeCallback(),this}toArray($=[],J=0){return $[J]=this._x,$[J+1]=this._y,$[J+2]=this._z,$[J+3]=this._w,$}fromBufferAttribute($,J){return this._x=$.getX(J),this._y=$.getY(J),this._z=$.getZ(J),this._w=$.getW(J),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange($){return this._onChangeCallback=$,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class S{constructor($=0,J=0,Q=0){S.prototype.isVector3=!0,this.x=$,this.y=J,this.z=Q}set($,J,Q){if(Q===void 0)Q=this.z;return this.x=$,this.y=J,this.z=Q,this}setScalar($){return this.x=$,this.y=$,this.z=$,this}setX($){return this.x=$,this}setY($){return this.y=$,this}setZ($){return this.z=$,this}setComponent($,J){switch($){case 0:this.x=J;break;case 1:this.y=J;break;case 2:this.z=J;break;default:throw Error("index is out of range: "+$)}return this}getComponent($){switch($){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("index is out of range: "+$)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy($){return this.x=$.x,this.y=$.y,this.z=$.z,this}add($){return this.x+=$.x,this.y+=$.y,this.z+=$.z,this}addScalar($){return this.x+=$,this.y+=$,this.z+=$,this}addVectors($,J){return this.x=$.x+J.x,this.y=$.y+J.y,this.z=$.z+J.z,this}addScaledVector($,J){return this.x+=$.x*J,this.y+=$.y*J,this.z+=$.z*J,this}sub($){return this.x-=$.x,this.y-=$.y,this.z-=$.z,this}subScalar($){return this.x-=$,this.y-=$,this.z-=$,this}subVectors($,J){return this.x=$.x-J.x,this.y=$.y-J.y,this.z=$.z-J.z,this}multiply($){return this.x*=$.x,this.y*=$.y,this.z*=$.z,this}multiplyScalar($){return this.x*=$,this.y*=$,this.z*=$,this}multiplyVectors($,J){return this.x=$.x*J.x,this.y=$.y*J.y,this.z=$.z*J.z,this}applyEuler($){return this.applyQuaternion(U7.setFromEuler($))}applyAxisAngle($,J){return this.applyQuaternion(U7.setFromAxisAngle($,J))}applyMatrix3($){let J=this.x,Q=this.y,M=this.z,H=$.elements;return this.x=H[0]*J+H[3]*Q+H[6]*M,this.y=H[1]*J+H[4]*Q+H[7]*M,this.z=H[2]*J+H[5]*Q+H[8]*M,this}applyNormalMatrix($){return this.applyMatrix3($).normalize()}applyMatrix4($){let J=this.x,Q=this.y,M=this.z,H=$.elements,K=1/(H[3]*J+H[7]*Q+H[11]*M+H[15]);return this.x=(H[0]*J+H[4]*Q+H[8]*M+H[12])*K,this.y=(H[1]*J+H[5]*Q+H[9]*M+H[13])*K,this.z=(H[2]*J+H[6]*Q+H[10]*M+H[14])*K,this}applyQuaternion($){let J=this.x,Q=this.y,M=this.z,H=$.x,K=$.y,W=$.z,k=$.w,E=2*(K*M-W*Q),w=2*(W*J-H*M),R=2*(H*Q-K*J);return this.x=J+k*E+K*R-W*w,this.y=Q+k*w+W*E-H*R,this.z=M+k*R+H*w-K*E,this}project($){return this.applyMatrix4($.matrixWorldInverse).applyMatrix4($.projectionMatrix)}unproject($){return this.applyMatrix4($.projectionMatrixInverse).applyMatrix4($.matrixWorld)}transformDirection($){let J=this.x,Q=this.y,M=this.z,H=$.elements;return this.x=H[0]*J+H[4]*Q+H[8]*M,this.y=H[1]*J+H[5]*Q+H[9]*M,this.z=H[2]*J+H[6]*Q+H[10]*M,this.normalize()}divide($){return this.x/=$.x,this.y/=$.y,this.z/=$.z,this}divideScalar($){return this.multiplyScalar(1/$)}min($){return this.x=Math.min(this.x,$.x),this.y=Math.min(this.y,$.y),this.z=Math.min(this.z,$.z),this}max($){return this.x=Math.max(this.x,$.x),this.y=Math.max(this.y,$.y),this.z=Math.max(this.z,$.z),this}clamp($,J){return this.x=n0(this.x,$.x,J.x),this.y=n0(this.y,$.y,J.y),this.z=n0(this.z,$.z,J.z),this}clampScalar($,J){return this.x=n0(this.x,$,J),this.y=n0(this.y,$,J),this.z=n0(this.z,$,J),this}clampLength($,J){let Q=this.length();return this.divideScalar(Q||1).multiplyScalar(n0(Q,$,J))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot($){return this.x*$.x+this.y*$.y+this.z*$.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength($){return this.normalize().multiplyScalar($)}lerp($,J){return this.x+=($.x-this.x)*J,this.y+=($.y-this.y)*J,this.z+=($.z-this.z)*J,this}lerpVectors($,J,Q){return this.x=$.x+(J.x-$.x)*Q,this.y=$.y+(J.y-$.y)*Q,this.z=$.z+(J.z-$.z)*Q,this}cross($){return this.crossVectors(this,$)}crossVectors($,J){let{x:Q,y:M,z:H}=$,K=J.x,W=J.y,k=J.z;return this.x=M*k-H*W,this.y=H*K-Q*k,this.z=Q*W-M*K,this}projectOnVector($){let J=$.lengthSq();if(J===0)return this.set(0,0,0);let Q=$.dot(this)/J;return this.copy($).multiplyScalar(Q)}projectOnPlane($){return t$.copy(this).projectOnVector($),this.sub(t$)}reflect($){return this.sub(t$.copy($).multiplyScalar(2*this.dot($)))}angleTo($){let J=Math.sqrt(this.lengthSq()*$.lengthSq());if(J===0)return Math.PI/2;let Q=this.dot($)/J;return Math.acos(n0(Q,-1,1))}distanceTo($){return Math.sqrt(this.distanceToSquared($))}distanceToSquared($){let J=this.x-$.x,Q=this.y-$.y,M=this.z-$.z;return J*J+Q*Q+M*M}manhattanDistanceTo($){return Math.abs(this.x-$.x)+Math.abs(this.y-$.y)+Math.abs(this.z-$.z)}setFromSpherical($){return this.setFromSphericalCoords($.radius,$.phi,$.theta)}setFromSphericalCoords($,J,Q){let M=Math.sin(J)*$;return this.x=M*Math.sin(Q),this.y=Math.cos(J)*$,this.z=M*Math.cos(Q),this}setFromCylindrical($){return this.setFromCylindricalCoords($.radius,$.theta,$.y)}setFromCylindricalCoords($,J,Q){return this.x=$*Math.sin(J),this.y=Q,this.z=$*Math.cos(J),this}setFromMatrixPosition($){let J=$.elements;return this.x=J[12],this.y=J[13],this.z=J[14],this}setFromMatrixScale($){let J=this.setFromMatrixColumn($,0).length(),Q=this.setFromMatrixColumn($,1).length(),M=this.setFromMatrixColumn($,2).length();return this.x=J,this.y=Q,this.z=M,this}setFromMatrixColumn($,J){return this.fromArray($.elements,J*4)}setFromMatrix3Column($,J){return this.fromArray($.elements,J*3)}setFromEuler($){return this.x=$._x,this.y=$._y,this.z=$._z,this}setFromColor($){return this.x=$.r,this.y=$.g,this.z=$.b,this}equals($){return $.x===this.x&&$.y===this.y&&$.z===this.z}fromArray($,J=0){return this.x=$[J],this.y=$[J+1],this.z=$[J+2],this}toArray($=[],J=0){return $[J]=this.x,$[J+1]=this.y,$[J+2]=this.z,$}fromBufferAttribute($,J){return this.x=$.getX(J),this.y=$.getY(J),this.z=$.getZ(J),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let $=Math.random()*Math.PI*2,J=Math.random()*2-1,Q=Math.sqrt(1-J*J);return this.x=Q*Math.cos($),this.y=J,this.z=Q*Math.sin($),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var t$=new S,U7=new m0;class x0{constructor($,J,Q,M,H,K,W,k,E){if(x0.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],$!==void 0)this.set($,J,Q,M,H,K,W,k,E)}set($,J,Q,M,H,K,W,k,E){let w=this.elements;return w[0]=$,w[1]=M,w[2]=W,w[3]=J,w[4]=H,w[5]=k,w[6]=Q,w[7]=K,w[8]=E,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy($){let J=this.elements,Q=$.elements;return J[0]=Q[0],J[1]=Q[1],J[2]=Q[2],J[3]=Q[3],J[4]=Q[4],J[5]=Q[5],J[6]=Q[6],J[7]=Q[7],J[8]=Q[8],this}extractBasis($,J,Q){return $.setFromMatrix3Column(this,0),J.setFromMatrix3Column(this,1),Q.setFromMatrix3Column(this,2),this}setFromMatrix4($){let J=$.elements;return this.set(J[0],J[4],J[8],J[1],J[5],J[9],J[2],J[6],J[10]),this}multiply($){return this.multiplyMatrices(this,$)}premultiply($){return this.multiplyMatrices($,this)}multiplyMatrices($,J){let Q=$.elements,M=J.elements,H=this.elements,K=Q[0],W=Q[3],k=Q[6],E=Q[1],w=Q[4],R=Q[7],Z=Q[2],U=Q[5],X=Q[8],G=M[0],q=M[3],Y=M[6],N=M[1],B=M[4],D=M[7],V=M[2],h=M[5],C=M[8];return H[0]=K*G+W*N+k*V,H[3]=K*q+W*B+k*h,H[6]=K*Y+W*D+k*C,H[1]=E*G+w*N+R*V,H[4]=E*q+w*B+R*h,H[7]=E*Y+w*D+R*C,H[2]=Z*G+U*N+X*V,H[5]=Z*q+U*B+X*h,H[8]=Z*Y+U*D+X*C,this}multiplyScalar($){let J=this.elements;return J[0]*=$,J[3]*=$,J[6]*=$,J[1]*=$,J[4]*=$,J[7]*=$,J[2]*=$,J[5]*=$,J[8]*=$,this}determinant(){let $=this.elements,J=$[0],Q=$[1],M=$[2],H=$[3],K=$[4],W=$[5],k=$[6],E=$[7],w=$[8];return J*K*w-J*W*E-Q*H*w+Q*W*k+M*H*E-M*K*k}invert(){let $=this.elements,J=$[0],Q=$[1],M=$[2],H=$[3],K=$[4],W=$[5],k=$[6],E=$[7],w=$[8],R=w*K-W*E,Z=W*k-w*H,U=E*H-K*k,X=J*R+Q*Z+M*U;if(X===0)return this.set(0,0,0,0,0,0,0,0,0);let G=1/X;return $[0]=R*G,$[1]=(M*E-w*Q)*G,$[2]=(W*Q-M*K)*G,$[3]=Z*G,$[4]=(w*J-M*k)*G,$[5]=(M*H-W*J)*G,$[6]=U*G,$[7]=(Q*k-E*J)*G,$[8]=(K*J-Q*H)*G,this}transpose(){let $,J=this.elements;return $=J[1],J[1]=J[3],J[3]=$,$=J[2],J[2]=J[6],J[6]=$,$=J[5],J[5]=J[7],J[7]=$,this}getNormalMatrix($){return this.setFromMatrix4($).invert().transpose()}transposeIntoArray($){let J=this.elements;return $[0]=J[0],$[1]=J[3],$[2]=J[6],$[3]=J[1],$[4]=J[4],$[5]=J[7],$[6]=J[2],$[7]=J[5],$[8]=J[8],this}setUvTransform($,J,Q,M,H,K,W){let k=Math.cos(H),E=Math.sin(H);return this.set(Q*k,Q*E,-Q*(k*K+E*W)+K+$,-M*E,M*k,-M*(-E*K+k*W)+W+J,0,0,1),this}scale($,J){return this.premultiply(e$.makeScale($,J)),this}rotate($){return this.premultiply(e$.makeRotation(-$)),this}translate($,J){return this.premultiply(e$.makeTranslation($,J)),this}makeTranslation($,J){if($.isVector2)this.set(1,0,$.x,0,1,$.y,0,0,1);else this.set(1,0,$,0,1,J,0,0,1);return this}makeRotation($){let J=Math.cos($),Q=Math.sin($);return this.set(J,-Q,0,Q,J,0,0,0,1),this}makeScale($,J){return this.set($,0,0,0,J,0,0,0,1),this}equals($){let J=this.elements,Q=$.elements;for(let M=0;M<9;M++)if(J[M]!==Q[M])return!1;return!0}fromArray($,J=0){for(let Q=0;Q<9;Q++)this.elements[Q]=$[Q+J];return this}toArray($=[],J=0){let Q=this.elements;return $[J]=Q[0],$[J+1]=Q[1],$[J+2]=Q[2],$[J+3]=Q[3],$[J+4]=Q[4],$[J+5]=Q[5],$[J+6]=Q[6],$[J+7]=Q[7],$[J+8]=Q[8],$}clone(){return new this.constructor().fromArray(this.elements)}}var e$=new x0;function kJ($){for(let J=$.length-1;J>=0;--J)if($[J]>=65535)return!0;return!1}function J6($){return document.createElementNS("http://www.w3.org/1999/xhtml",$)}function vQ(){let $=J6("canvas");return $.style.display="block",$}var Y7={};function o5($){if($ in Y7)return;Y7[$]=!0,console.warn($)}function bQ($,J,Q){return new Promise(function(M,H){function K(){switch($.clientWaitSync(J,$.SYNC_FLUSH_COMMANDS_BIT,0)){case $.WAIT_FAILED:H();break;case $.TIMEOUT_EXPIRED:setTimeout(K,Q);break;default:M()}}setTimeout(K,Q)})}var N7=new x0().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),X7=new x0().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function YH(){let $={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(H,K,W){if(this.enabled===!1||K===W||!K||!W)return H;if(this.spaces[K].transfer==="srgb")H.r=V5(H.r),H.g=V5(H.g),H.b=V5(H.b);if(this.spaces[K].primaries!==this.spaces[W].primaries)H.applyMatrix3(this.spaces[K].toXYZ),H.applyMatrix3(this.spaces[W].fromXYZ);if(this.spaces[W].transfer==="srgb")H.r=B8(H.r),H.g=B8(H.g),H.b=B8(H.b);return H},workingToColorSpace:function(H,K){return this.convert(H,this.workingColorSpace,K)},colorSpaceToWorking:function(H,K){return this.convert(H,K,this.workingColorSpace)},getPrimaries:function(H){return this.spaces[H].primaries},getTransfer:function(H){if(H==="")return"linear";return this.spaces[H].transfer},getLuminanceCoefficients:function(H,K=this.workingColorSpace){return H.fromArray(this.spaces[K].luminanceCoefficients)},define:function(H){Object.assign(this.spaces,H)},_getMatrix:function(H,K,W){return H.copy(this.spaces[K].toXYZ).multiply(this.spaces[W].fromXYZ)},_getDrawingBufferColorSpace:function(H){return this.spaces[H].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(H=this.workingColorSpace){return this.spaces[H].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(H,K){return o5("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),$.workingToColorSpace(H,K)},toWorkingColorSpace:function(H,K){return o5("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),$.colorSpaceToWorking(H,K)}},J=[0.64,0.33,0.3,0.6,0.15,0.06],Q=[0.2126,0.7152,0.0722],M=[0.3127,0.329];return $.define({["srgb-linear"]:{primaries:J,whitePoint:M,transfer:"linear",toXYZ:N7,fromXYZ:X7,luminanceCoefficients:Q,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:J,whitePoint:M,transfer:"srgb",toXYZ:N7,fromXYZ:X7,luminanceCoefficients:Q,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),$}var i0=YH();function V5($){return $<0.04045?$*0.0773993808:Math.pow($*0.9478672986+0.0521327014,2.4)}function B8($){return $<0.0031308?$*12.92:1.055*Math.pow($,0.41666)-0.055}var U8;class EJ{static getDataURL($,J="image/png"){if(/^data:/i.test($.src))return $.src;if(typeof HTMLCanvasElement>"u")return $.src;let Q;if($ instanceof HTMLCanvasElement)Q=$;else{if(U8===void 0)U8=J6("canvas");U8.width=$.width,U8.height=$.height;let M=U8.getContext("2d");if($ instanceof ImageData)M.putImageData($,0,0);else M.drawImage($,0,0,$.width,$.height);Q=U8}return Q.toDataURL(J)}static sRGBToLinear($){if(typeof HTMLImageElement<"u"&&$ instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&$ instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&$ instanceof ImageBitmap){let J=J6("canvas");J.width=$.width,J.height=$.height;let Q=J.getContext("2d");Q.drawImage($,0,0,$.width,$.height);let M=Q.getImageData(0,0,$.width,$.height),H=M.data;for(let K=0;K<H.length;K++)H[K]=V5(H[K]/255)*255;return Q.putImageData(M,0,0),J}else if($.data){let J=$.data.slice(0);for(let Q=0;Q<J.length;Q++)if(J instanceof Uint8Array||J instanceof Uint8ClampedArray)J[Q]=Math.floor(V5(J[Q]/255)*255);else J[Q]=V5(J[Q]);return{data:J,width:$.width,height:$.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),$}}var NH=0;class R6{constructor($=null){this.isSource=!0,Object.defineProperty(this,"id",{value:NH++}),this.uuid=Z6(),this.data=$,this.dataReady=!0,this.version=0}getSize($){let J=this.data;if(J instanceof HTMLVideoElement)$.set(J.videoWidth,J.videoHeight,0);else if(J instanceof VideoFrame)$.set(J.displayHeight,J.displayWidth,0);else if(J!==null)$.set(J.width,J.height,J.depth||0);else $.set(0,0,0);return $}set needsUpdate($){if($===!0)this.version++}toJSON($){let J=$===void 0||typeof $==="string";if(!J&&$.images[this.uuid]!==void 0)return $.images[this.uuid];let Q={uuid:this.uuid,url:""},M=this.data;if(M!==null){let H;if(Array.isArray(M)){H=[];for(let K=0,W=M.length;K<W;K++)if(M[K].isDataTexture)H.push($9(M[K].image));else H.push($9(M[K]))}else H=$9(M);Q.url=H}if(!J)$.images[this.uuid]=Q;return Q}}function $9($){if(typeof HTMLImageElement<"u"&&$ instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&$ instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&$ instanceof ImageBitmap)return EJ.getDataURL($);else if($.data)return{data:Array.from($.data),width:$.width,height:$.height,type:$.data.constructor.name};else return console.warn("THREE.Texture: Unable to serialize Texture."),{}}var XH=0,J9=new S;class A1 extends v5{constructor($=A1.DEFAULT_IMAGE,J=A1.DEFAULT_MAPPING,Q=1001,M=1001,H=1006,K=1008,W=1023,k=1009,E=A1.DEFAULT_ANISOTROPY,w=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:XH++}),this.uuid=Z6(),this.name="",this.source=new R6($),this.mipmaps=[],this.mapping=J,this.channel=0,this.wrapS=Q,this.wrapT=M,this.magFilter=H,this.minFilter=K,this.anisotropy=E,this.format=W,this.internalFormat=null,this.type=k,this.offset=new $1(0,0),this.repeat=new $1(1,1),this.center=new $1(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new x0,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=w,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=$&&$.depth&&$.depth>1?!0:!1,this.pmremVersion=0}get width(){return this.source.getSize(J9).x}get height(){return this.source.getSize(J9).y}get depth(){return this.source.getSize(J9).z}get image(){return this.source.data}set image($=null){this.source.data=$}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange($,J){this.updateRanges.push({start:$,count:J})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy($){return this.name=$.name,this.source=$.source,this.mipmaps=$.mipmaps.slice(0),this.mapping=$.mapping,this.channel=$.channel,this.wrapS=$.wrapS,this.wrapT=$.wrapT,this.magFilter=$.magFilter,this.minFilter=$.minFilter,this.anisotropy=$.anisotropy,this.format=$.format,this.internalFormat=$.internalFormat,this.type=$.type,this.offset.copy($.offset),this.repeat.copy($.repeat),this.center.copy($.center),this.rotation=$.rotation,this.matrixAutoUpdate=$.matrixAutoUpdate,this.matrix.copy($.matrix),this.generateMipmaps=$.generateMipmaps,this.premultiplyAlpha=$.premultiplyAlpha,this.flipY=$.flipY,this.unpackAlignment=$.unpackAlignment,this.colorSpace=$.colorSpace,this.renderTarget=$.renderTarget,this.isRenderTargetTexture=$.isRenderTargetTexture,this.isArrayTexture=$.isArrayTexture,this.userData=JSON.parse(JSON.stringify($.userData)),this.needsUpdate=!0,this}setValues($){for(let J in $){let Q=$[J];if(Q===void 0){console.warn(`THREE.Texture.setValues(): parameter '${J}' has value of undefined.`);continue}let M=this[J];if(M===void 0){console.warn(`THREE.Texture.setValues(): property '${J}' does not exist.`);continue}if(M&&Q&&(M.isVector2&&Q.isVector2))M.copy(Q);else if(M&&Q&&(M.isVector3&&Q.isVector3))M.copy(Q);else if(M&&Q&&(M.isMatrix3&&Q.isMatrix3))M.copy(Q);else this[J]=Q}}toJSON($){let J=$===void 0||typeof $==="string";if(!J&&$.textures[this.uuid]!==void 0)return $.textures[this.uuid];let Q={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON($).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)Q.userData=this.userData;if(!J)$.textures[this.uuid]=Q;return Q}dispose(){this.dispatchEvent({type:"dispose"})}transformUv($){if(this.mapping!==300)return $;if($.applyMatrix3(this.matrix),$.x<0||$.x>1)switch(this.wrapS){case 1000:$.x=$.x-Math.floor($.x);break;case 1001:$.x=$.x<0?0:1;break;case 1002:if(Math.abs(Math.floor($.x)%2)===1)$.x=Math.ceil($.x)-$.x;else $.x=$.x-Math.floor($.x);break}if($.y<0||$.y>1)switch(this.wrapT){case 1000:$.y=$.y-Math.floor($.y);break;case 1001:$.y=$.y<0?0:1;break;case 1002:if(Math.abs(Math.floor($.y)%2)===1)$.y=Math.ceil($.y)-$.y;else $.y=$.y-Math.floor($.y);break}if(this.flipY)$.y=1-$.y;return $}set needsUpdate($){if($===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate($){if($===!0)this.pmremVersion++}}A1.DEFAULT_IMAGE=null;A1.DEFAULT_MAPPING=300;A1.DEFAULT_ANISOTROPY=1;class U1{constructor($=0,J=0,Q=0,M=1){U1.prototype.isVector4=!0,this.x=$,this.y=J,this.z=Q,this.w=M}get width(){return this.z}set width($){this.z=$}get height(){return this.w}set height($){this.w=$}set($,J,Q,M){return this.x=$,this.y=J,this.z=Q,this.w=M,this}setScalar($){return this.x=$,this.y=$,this.z=$,this.w=$,this}setX($){return this.x=$,this}setY($){return this.y=$,this}setZ($){return this.z=$,this}setW($){return this.w=$,this}setComponent($,J){switch($){case 0:this.x=J;break;case 1:this.y=J;break;case 2:this.z=J;break;case 3:this.w=J;break;default:throw Error("index is out of range: "+$)}return this}getComponent($){switch($){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("index is out of range: "+$)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy($){return this.x=$.x,this.y=$.y,this.z=$.z,this.w=$.w!==void 0?$.w:1,this}add($){return this.x+=$.x,this.y+=$.y,this.z+=$.z,this.w+=$.w,this}addScalar($){return this.x+=$,this.y+=$,this.z+=$,this.w+=$,this}addVectors($,J){return this.x=$.x+J.x,this.y=$.y+J.y,this.z=$.z+J.z,this.w=$.w+J.w,this}addScaledVector($,J){return this.x+=$.x*J,this.y+=$.y*J,this.z+=$.z*J,this.w+=$.w*J,this}sub($){return this.x-=$.x,this.y-=$.y,this.z-=$.z,this.w-=$.w,this}subScalar($){return this.x-=$,this.y-=$,this.z-=$,this.w-=$,this}subVectors($,J){return this.x=$.x-J.x,this.y=$.y-J.y,this.z=$.z-J.z,this.w=$.w-J.w,this}multiply($){return this.x*=$.x,this.y*=$.y,this.z*=$.z,this.w*=$.w,this}multiplyScalar($){return this.x*=$,this.y*=$,this.z*=$,this.w*=$,this}applyMatrix4($){let J=this.x,Q=this.y,M=this.z,H=this.w,K=$.elements;return this.x=K[0]*J+K[4]*Q+K[8]*M+K[12]*H,this.y=K[1]*J+K[5]*Q+K[9]*M+K[13]*H,this.z=K[2]*J+K[6]*Q+K[10]*M+K[14]*H,this.w=K[3]*J+K[7]*Q+K[11]*M+K[15]*H,this}divide($){return this.x/=$.x,this.y/=$.y,this.z/=$.z,this.w/=$.w,this}divideScalar($){return this.multiplyScalar(1/$)}setAxisAngleFromQuaternion($){this.w=2*Math.acos($.w);let J=Math.sqrt(1-$.w*$.w);if(J<0.0001)this.x=1,this.y=0,this.z=0;else this.x=$.x/J,this.y=$.y/J,this.z=$.z/J;return this}setAxisAngleFromRotationMatrix($){let J,Q,M,H,K=0.01,W=0.1,k=$.elements,E=k[0],w=k[4],R=k[8],Z=k[1],U=k[5],X=k[9],G=k[2],q=k[6],Y=k[10];if(Math.abs(w-Z)<0.01&&Math.abs(R-G)<0.01&&Math.abs(X-q)<0.01){if(Math.abs(w+Z)<0.1&&Math.abs(R+G)<0.1&&Math.abs(X+q)<0.1&&Math.abs(E+U+Y-3)<0.1)return this.set(1,0,0,0),this;J=Math.PI;let B=(E+1)/2,D=(U+1)/2,V=(Y+1)/2,h=(w+Z)/4,C=(R+G)/4,z=(X+q)/4;if(B>D&&B>V)if(B<0.01)Q=0,M=0.707106781,H=0.707106781;else Q=Math.sqrt(B),M=h/Q,H=C/Q;else if(D>V)if(D<0.01)Q=0.707106781,M=0,H=0.707106781;else M=Math.sqrt(D),Q=h/M,H=z/M;else if(V<0.01)Q=0.707106781,M=0.707106781,H=0;else H=Math.sqrt(V),Q=C/H,M=z/H;return this.set(Q,M,H,J),this}let N=Math.sqrt((q-X)*(q-X)+(R-G)*(R-G)+(Z-w)*(Z-w));if(Math.abs(N)<0.001)N=1;return this.x=(q-X)/N,this.y=(R-G)/N,this.z=(Z-w)/N,this.w=Math.acos((E+U+Y-1)/2),this}setFromMatrixPosition($){let J=$.elements;return this.x=J[12],this.y=J[13],this.z=J[14],this.w=J[15],this}min($){return this.x=Math.min(this.x,$.x),this.y=Math.min(this.y,$.y),this.z=Math.min(this.z,$.z),this.w=Math.min(this.w,$.w),this}max($){return this.x=Math.max(this.x,$.x),this.y=Math.max(this.y,$.y),this.z=Math.max(this.z,$.z),this.w=Math.max(this.w,$.w),this}clamp($,J){return this.x=n0(this.x,$.x,J.x),this.y=n0(this.y,$.y,J.y),this.z=n0(this.z,$.z,J.z),this.w=n0(this.w,$.w,J.w),this}clampScalar($,J){return this.x=n0(this.x,$,J),this.y=n0(this.y,$,J),this.z=n0(this.z,$,J),this.w=n0(this.w,$,J),this}clampLength($,J){let Q=this.length();return this.divideScalar(Q||1).multiplyScalar(n0(Q,$,J))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot($){return this.x*$.x+this.y*$.y+this.z*$.z+this.w*$.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength($){return this.normalize().multiplyScalar($)}lerp($,J){return this.x+=($.x-this.x)*J,this.y+=($.y-this.y)*J,this.z+=($.z-this.z)*J,this.w+=($.w-this.w)*J,this}lerpVectors($,J,Q){return this.x=$.x+(J.x-$.x)*Q,this.y=$.y+(J.y-$.y)*Q,this.z=$.z+(J.z-$.z)*Q,this.w=$.w+(J.w-$.w)*Q,this}equals($){return $.x===this.x&&$.y===this.y&&$.z===this.z&&$.w===this.w}fromArray($,J=0){return this.x=$[J],this.y=$[J+1],this.z=$[J+2],this.w=$[J+3],this}toArray($=[],J=0){return $[J]=this.x,$[J+1]=this.y,$[J+2]=this.z,$[J+3]=this.w,$}fromBufferAttribute($,J){return this.x=$.getX(J),this.y=$.getY(J),this.z=$.getZ(J),this.w=$.getW(J),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class wJ extends v5{constructor($=1,J=1,Q={}){super();Q=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},Q),this.isRenderTarget=!0,this.width=$,this.height=J,this.depth=Q.depth,this.scissor=new U1(0,0,$,J),this.scissorTest=!1,this.viewport=new U1(0,0,$,J);let M={width:$,height:J,depth:Q.depth},H=new A1(M);this.textures=[];let K=Q.count;for(let W=0;W<K;W++)this.textures[W]=H.clone(),this.textures[W].isRenderTargetTexture=!0,this.textures[W].renderTarget=this;this._setTextureOptions(Q),this.depthBuffer=Q.depthBuffer,this.stencilBuffer=Q.stencilBuffer,this.resolveDepthBuffer=Q.resolveDepthBuffer,this.resolveStencilBuffer=Q.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=Q.depthTexture,this.samples=Q.samples,this.multiview=Q.multiview}_setTextureOptions($={}){let J={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if($.mapping!==void 0)J.mapping=$.mapping;if($.wrapS!==void 0)J.wrapS=$.wrapS;if($.wrapT!==void 0)J.wrapT=$.wrapT;if($.wrapR!==void 0)J.wrapR=$.wrapR;if($.magFilter!==void 0)J.magFilter=$.magFilter;if($.minFilter!==void 0)J.minFilter=$.minFilter;if($.format!==void 0)J.format=$.format;if($.type!==void 0)J.type=$.type;if($.anisotropy!==void 0)J.anisotropy=$.anisotropy;if($.colorSpace!==void 0)J.colorSpace=$.colorSpace;if($.flipY!==void 0)J.flipY=$.flipY;if($.generateMipmaps!==void 0)J.generateMipmaps=$.generateMipmaps;if($.internalFormat!==void 0)J.internalFormat=$.internalFormat;for(let Q=0;Q<this.textures.length;Q++)this.textures[Q].setValues(J)}get texture(){return this.textures[0]}set texture($){this.textures[0]=$}set depthTexture($){if(this._depthTexture!==null)this._depthTexture.renderTarget=null;if($!==null)$.renderTarget=this;this._depthTexture=$}get depthTexture(){return this._depthTexture}setSize($,J,Q=1){if(this.width!==$||this.height!==J||this.depth!==Q){this.width=$,this.height=J,this.depth=Q;for(let M=0,H=this.textures.length;M<H;M++)this.textures[M].image.width=$,this.textures[M].image.height=J,this.textures[M].image.depth=Q,this.textures[M].isArrayTexture=this.textures[M].image.depth>1;this.dispose()}this.viewport.set(0,0,$,J),this.scissor.set(0,0,$,J)}clone(){return new this.constructor().copy(this)}copy($){this.width=$.width,this.height=$.height,this.depth=$.depth,this.scissor.copy($.scissor),this.scissorTest=$.scissorTest,this.viewport.copy($.viewport),this.textures.length=0;for(let J=0,Q=$.textures.length;J<Q;J++){this.textures[J]=$.textures[J].clone(),this.textures[J].isRenderTargetTexture=!0,this.textures[J].renderTarget=this;let M=Object.assign({},$.textures[J].image);this.textures[J].source=new R6(M)}if(this.depthBuffer=$.depthBuffer,this.stencilBuffer=$.stencilBuffer,this.resolveDepthBuffer=$.resolveDepthBuffer,this.resolveStencilBuffer=$.resolveStencilBuffer,$.depthTexture!==null)this.depthTexture=$.depthTexture.clone();return this.samples=$.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class $5 extends wJ{constructor($=1,J=1,Q={}){super($,J,Q);this.isWebGLRenderTarget=!0}}class X$ extends A1{constructor($=null,J=1,Q=1,M=1){super(null);this.isDataArrayTexture=!0,this.image={data:$,width:J,height:Q,depth:M},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate($){this.layerUpdates.add($)}clearLayerUpdates(){this.layerUpdates.clear()}}class ZJ extends A1{constructor($=null,J=1,Q=1,M=1){super(null);this.isData3DTexture=!0,this.image={data:$,width:J,height:Q,depth:M},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class t5{constructor($=new S(1/0,1/0,1/0),J=new S(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=$,this.max=J}set($,J){return this.min.copy($),this.max.copy(J),this}setFromArray($){this.makeEmpty();for(let J=0,Q=$.length;J<Q;J+=3)this.expandByPoint(H5.fromArray($,J));return this}setFromBufferAttribute($){this.makeEmpty();for(let J=0,Q=$.count;J<Q;J++)this.expandByPoint(H5.fromBufferAttribute($,J));return this}setFromPoints($){this.makeEmpty();for(let J=0,Q=$.length;J<Q;J++)this.expandByPoint($[J]);return this}setFromCenterAndSize($,J){let Q=H5.copy(J).multiplyScalar(0.5);return this.min.copy($).sub(Q),this.max.copy($).add(Q),this}setFromObject($,J=!1){return this.makeEmpty(),this.expandByObject($,J)}clone(){return new this.constructor().copy(this)}copy($){return this.min.copy($.min),this.max.copy($.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter($){return this.isEmpty()?$.set(0,0,0):$.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize($){return this.isEmpty()?$.set(0,0,0):$.subVectors(this.max,this.min)}expandByPoint($){return this.min.min($),this.max.max($),this}expandByVector($){return this.min.sub($),this.max.add($),this}expandByScalar($){return this.min.addScalar(-$),this.max.addScalar($),this}expandByObject($,J=!1){$.updateWorldMatrix(!1,!1);let Q=$.geometry;if(Q!==void 0){let H=Q.getAttribute("position");if(J===!0&&H!==void 0&&$.isInstancedMesh!==!0)for(let K=0,W=H.count;K<W;K++){if($.isMesh===!0)$.getVertexPosition(K,H5);else H5.fromBufferAttribute(H,K);H5.applyMatrix4($.matrixWorld),this.expandByPoint(H5)}else{if($.boundingBox!==void 0){if($.boundingBox===null)$.computeBoundingBox();T6.copy($.boundingBox)}else{if(Q.boundingBox===null)Q.computeBoundingBox();T6.copy(Q.boundingBox)}T6.applyMatrix4($.matrixWorld),this.union(T6)}}let M=$.children;for(let H=0,K=M.length;H<K;H++)this.expandByObject(M[H],J);return this}containsPoint($){return $.x>=this.min.x&&$.x<=this.max.x&&$.y>=this.min.y&&$.y<=this.max.y&&$.z>=this.min.z&&$.z<=this.max.z}containsBox($){return this.min.x<=$.min.x&&$.max.x<=this.max.x&&this.min.y<=$.min.y&&$.max.y<=this.max.y&&this.min.z<=$.min.z&&$.max.z<=this.max.z}getParameter($,J){return J.set(($.x-this.min.x)/(this.max.x-this.min.x),($.y-this.min.y)/(this.max.y-this.min.y),($.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox($){return $.max.x>=this.min.x&&$.min.x<=this.max.x&&$.max.y>=this.min.y&&$.min.y<=this.max.y&&$.max.z>=this.min.z&&$.min.z<=this.max.z}intersectsSphere($){return this.clampPoint($.center,H5),H5.distanceToSquared($.center)<=$.radius*$.radius}intersectsPlane($){let J,Q;if($.normal.x>0)J=$.normal.x*this.min.x,Q=$.normal.x*this.max.x;else J=$.normal.x*this.max.x,Q=$.normal.x*this.min.x;if($.normal.y>0)J+=$.normal.y*this.min.y,Q+=$.normal.y*this.max.y;else J+=$.normal.y*this.max.y,Q+=$.normal.y*this.min.y;if($.normal.z>0)J+=$.normal.z*this.min.z,Q+=$.normal.z*this.max.z;else J+=$.normal.z*this.max.z,Q+=$.normal.z*this.min.z;return J<=-$.constant&&Q>=-$.constant}intersectsTriangle($){if(this.isEmpty())return!1;this.getCenter(a8),h6.subVectors(this.max,a8),Y8.subVectors($.a,a8),N8.subVectors($.b,a8),X8.subVectors($.c,a8),_5.subVectors(N8,Y8),A5.subVectors(X8,N8),u5.subVectors(Y8,X8);let J=[0,-_5.z,_5.y,0,-A5.z,A5.y,0,-u5.z,u5.y,_5.z,0,-_5.x,A5.z,0,-A5.x,u5.z,0,-u5.x,-_5.y,_5.x,0,-A5.y,A5.x,0,-u5.y,u5.x,0];if(!Q9(J,Y8,N8,X8,h6))return!1;if(J=[1,0,0,0,1,0,0,0,1],!Q9(J,Y8,N8,X8,h6))return!1;return f6.crossVectors(_5,A5),J=[f6.x,f6.y,f6.z],Q9(J,Y8,N8,X8,h6)}clampPoint($,J){return J.copy($).clamp(this.min,this.max)}distanceToPoint($){return this.clampPoint($,H5).distanceTo($)}getBoundingSphere($){if(this.isEmpty())$.makeEmpty();else this.getCenter($.center),$.radius=this.getSize(H5).length()*0.5;return $}intersect($){if(this.min.max($.min),this.max.min($.max),this.isEmpty())this.makeEmpty();return this}union($){return this.min.min($.min),this.max.max($.max),this}applyMatrix4($){if(this.isEmpty())return this;return q5[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4($),q5[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4($),q5[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4($),q5[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4($),q5[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4($),q5[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4($),q5[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4($),q5[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4($),this.setFromPoints(q5),this}translate($){return this.min.add($),this.max.add($),this}equals($){return $.min.equals(this.min)&&$.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON($){return this.min.fromArray($.min),this.max.fromArray($.max),this}}var q5=[new S,new S,new S,new S,new S,new S,new S,new S],H5=new S,T6=new t5,Y8=new S,N8=new S,X8=new S,_5=new S,A5=new S,u5=new S,a8=new S,h6=new S,f6=new S,c5=new S;function Q9($,J,Q,M,H){for(let K=0,W=$.length-3;K<=W;K+=3){c5.fromArray($,K);let k=H.x*Math.abs(c5.x)+H.y*Math.abs(c5.y)+H.z*Math.abs(c5.z),E=J.dot(c5),w=Q.dot(c5),R=M.dot(c5);if(Math.max(-Math.max(E,w,R),Math.min(E,w,R))>k)return!1}return!0}var GH=new t5,r8=new S,M9=new S;class b5{constructor($=new S,J=-1){this.isSphere=!0,this.center=$,this.radius=J}set($,J){return this.center.copy($),this.radius=J,this}setFromPoints($,J){let Q=this.center;if(J!==void 0)Q.copy(J);else GH.setFromPoints($).getCenter(Q);let M=0;for(let H=0,K=$.length;H<K;H++)M=Math.max(M,Q.distanceToSquared($[H]));return this.radius=Math.sqrt(M),this}copy($){return this.center.copy($.center),this.radius=$.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint($){return $.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint($){return $.distanceTo(this.center)-this.radius}intersectsSphere($){let J=this.radius+$.radius;return $.center.distanceToSquared(this.center)<=J*J}intersectsBox($){return $.intersectsSphere(this)}intersectsPlane($){return Math.abs($.distanceToPoint(this.center))<=this.radius}clampPoint($,J){let Q=this.center.distanceToSquared($);if(J.copy($),Q>this.radius*this.radius)J.sub(this.center).normalize(),J.multiplyScalar(this.radius).add(this.center);return J}getBoundingBox($){if(this.isEmpty())return $.makeEmpty(),$;return $.set(this.center,this.center),$.expandByScalar(this.radius),$}applyMatrix4($){return this.center.applyMatrix4($),this.radius=this.radius*$.getMaxScaleOnAxis(),this}translate($){return this.center.add($),this}expandByPoint($){if(this.isEmpty())return this.center.copy($),this.radius=0,this;r8.subVectors($,this.center);let J=r8.lengthSq();if(J>this.radius*this.radius){let Q=Math.sqrt(J),M=(Q-this.radius)*0.5;this.center.addScaledVector(r8,M/Q),this.radius+=M}return this}union($){if($.isEmpty())return this;if(this.isEmpty())return this.copy($),this;if(this.center.equals($.center)===!0)this.radius=Math.max(this.radius,$.radius);else M9.subVectors($.center,this.center).setLength($.radius),this.expandByPoint(r8.copy($.center).add(M9)),this.expandByPoint(r8.copy($.center).sub(M9));return this}equals($){return $.center.equals(this.center)&&$.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON($){return this.radius=$.radius,this.center.fromArray($.center),this}}var O5=new S,H9=new S,j6=new S,S5=new S,K9=new S,y6=new S,W9=new S;class h8{constructor($=new S,J=new S(0,0,-1)){this.origin=$,this.direction=J}set($,J){return this.origin.copy($),this.direction.copy(J),this}copy($){return this.origin.copy($.origin),this.direction.copy($.direction),this}at($,J){return J.copy(this.origin).addScaledVector(this.direction,$)}lookAt($){return this.direction.copy($).sub(this.origin).normalize(),this}recast($){return this.origin.copy(this.at($,O5)),this}closestPointToPoint($,J){J.subVectors($,this.origin);let Q=J.dot(this.direction);if(Q<0)return J.copy(this.origin);return J.copy(this.origin).addScaledVector(this.direction,Q)}distanceToPoint($){return Math.sqrt(this.distanceSqToPoint($))}distanceSqToPoint($){let J=O5.subVectors($,this.origin).dot(this.direction);if(J<0)return this.origin.distanceToSquared($);return O5.copy(this.origin).addScaledVector(this.direction,J),O5.distanceToSquared($)}distanceSqToSegment($,J,Q,M){H9.copy($).add(J).multiplyScalar(0.5),j6.copy(J).sub($).normalize(),S5.copy(this.origin).sub(H9);let H=$.distanceTo(J)*0.5,K=-this.direction.dot(j6),W=S5.dot(this.direction),k=-S5.dot(j6),E=S5.lengthSq(),w=Math.abs(1-K*K),R,Z,U,X;if(w>0)if(R=K*k-W,Z=K*W-k,X=H*w,R>=0)if(Z>=-X)if(Z<=X){let G=1/w;R*=G,Z*=G,U=R*(R+K*Z+2*W)+Z*(K*R+Z+2*k)+E}else Z=H,R=Math.max(0,-(K*Z+W)),U=-R*R+Z*(Z+2*k)+E;else Z=-H,R=Math.max(0,-(K*Z+W)),U=-R*R+Z*(Z+2*k)+E;else if(Z<=-X)R=Math.max(0,-(-K*H+W)),Z=R>0?-H:Math.min(Math.max(-H,-k),H),U=-R*R+Z*(Z+2*k)+E;else if(Z<=X)R=0,Z=Math.min(Math.max(-H,-k),H),U=Z*(Z+2*k)+E;else R=Math.max(0,-(K*H+W)),Z=R>0?H:Math.min(Math.max(-H,-k),H),U=-R*R+Z*(Z+2*k)+E;else Z=K>0?-H:H,R=Math.max(0,-(K*Z+W)),U=-R*R+Z*(Z+2*k)+E;if(Q)Q.copy(this.origin).addScaledVector(this.direction,R);if(M)M.copy(H9).addScaledVector(j6,Z);return U}intersectSphere($,J){O5.subVectors($.center,this.origin);let Q=O5.dot(this.direction),M=O5.dot(O5)-Q*Q,H=$.radius*$.radius;if(M>H)return null;let K=Math.sqrt(H-M),W=Q-K,k=Q+K;if(k<0)return null;if(W<0)return this.at(k,J);return this.at(W,J)}intersectsSphere($){if($.radius<0)return!1;return this.distanceSqToPoint($.center)<=$.radius*$.radius}distanceToPlane($){let J=$.normal.dot(this.direction);if(J===0){if($.distanceToPoint(this.origin)===0)return 0;return null}let Q=-(this.origin.dot($.normal)+$.constant)/J;return Q>=0?Q:null}intersectPlane($,J){let Q=this.distanceToPlane($);if(Q===null)return null;return this.at(Q,J)}intersectsPlane($){let J=$.distanceToPoint(this.origin);if(J===0)return!0;if($.normal.dot(this.direction)*J<0)return!0;return!1}intersectBox($,J){let Q,M,H,K,W,k,E=1/this.direction.x,w=1/this.direction.y,R=1/this.direction.z,Z=this.origin;if(E>=0)Q=($.min.x-Z.x)*E,M=($.max.x-Z.x)*E;else Q=($.max.x-Z.x)*E,M=($.min.x-Z.x)*E;if(w>=0)H=($.min.y-Z.y)*w,K=($.max.y-Z.y)*w;else H=($.max.y-Z.y)*w,K=($.min.y-Z.y)*w;if(Q>K||H>M)return null;if(H>Q||isNaN(Q))Q=H;if(K<M||isNaN(M))M=K;if(R>=0)W=($.min.z-Z.z)*R,k=($.max.z-Z.z)*R;else W=($.max.z-Z.z)*R,k=($.min.z-Z.z)*R;if(Q>k||W>M)return null;if(W>Q||Q!==Q)Q=W;if(k<M||M!==M)M=k;if(M<0)return null;return this.at(Q>=0?Q:M,J)}intersectsBox($){return this.intersectBox($,O5)!==null}intersectTriangle($,J,Q,M,H){K9.subVectors(J,$),y6.subVectors(Q,$),W9.crossVectors(K9,y6);let K=this.direction.dot(W9),W;if(K>0){if(M)return null;W=1}else if(K<0)W=-1,K=-K;else return null;S5.subVectors(this.origin,$);let k=W*this.direction.dot(y6.crossVectors(S5,y6));if(k<0)return null;let E=W*this.direction.dot(K9.cross(S5));if(E<0)return null;if(k+E>K)return null;let w=-W*S5.dot(W9);if(w<0)return null;return this.at(w/K,H)}applyMatrix4($){return this.origin.applyMatrix4($),this.direction.transformDirection($),this}equals($){return $.origin.equals(this.origin)&&$.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class M1{constructor($,J,Q,M,H,K,W,k,E,w,R,Z,U,X,G,q){if(M1.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],$!==void 0)this.set($,J,Q,M,H,K,W,k,E,w,R,Z,U,X,G,q)}set($,J,Q,M,H,K,W,k,E,w,R,Z,U,X,G,q){let Y=this.elements;return Y[0]=$,Y[4]=J,Y[8]=Q,Y[12]=M,Y[1]=H,Y[5]=K,Y[9]=W,Y[13]=k,Y[2]=E,Y[6]=w,Y[10]=R,Y[14]=Z,Y[3]=U,Y[7]=X,Y[11]=G,Y[15]=q,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new M1().fromArray(this.elements)}copy($){let J=this.elements,Q=$.elements;return J[0]=Q[0],J[1]=Q[1],J[2]=Q[2],J[3]=Q[3],J[4]=Q[4],J[5]=Q[5],J[6]=Q[6],J[7]=Q[7],J[8]=Q[8],J[9]=Q[9],J[10]=Q[10],J[11]=Q[11],J[12]=Q[12],J[13]=Q[13],J[14]=Q[14],J[15]=Q[15],this}copyPosition($){let J=this.elements,Q=$.elements;return J[12]=Q[12],J[13]=Q[13],J[14]=Q[14],this}setFromMatrix3($){let J=$.elements;return this.set(J[0],J[3],J[6],0,J[1],J[4],J[7],0,J[2],J[5],J[8],0,0,0,0,1),this}extractBasis($,J,Q){return $.setFromMatrixColumn(this,0),J.setFromMatrixColumn(this,1),Q.setFromMatrixColumn(this,2),this}makeBasis($,J,Q){return this.set($.x,J.x,Q.x,0,$.y,J.y,Q.y,0,$.z,J.z,Q.z,0,0,0,0,1),this}extractRotation($){let J=this.elements,Q=$.elements,M=1/G8.setFromMatrixColumn($,0).length(),H=1/G8.setFromMatrixColumn($,1).length(),K=1/G8.setFromMatrixColumn($,2).length();return J[0]=Q[0]*M,J[1]=Q[1]*M,J[2]=Q[2]*M,J[3]=0,J[4]=Q[4]*H,J[5]=Q[5]*H,J[6]=Q[6]*H,J[7]=0,J[8]=Q[8]*K,J[9]=Q[9]*K,J[10]=Q[10]*K,J[11]=0,J[12]=0,J[13]=0,J[14]=0,J[15]=1,this}makeRotationFromEuler($){let J=this.elements,Q=$.x,M=$.y,H=$.z,K=Math.cos(Q),W=Math.sin(Q),k=Math.cos(M),E=Math.sin(M),w=Math.cos(H),R=Math.sin(H);if($.order==="XYZ"){let Z=K*w,U=K*R,X=W*w,G=W*R;J[0]=k*w,J[4]=-k*R,J[8]=E,J[1]=U+X*E,J[5]=Z-G*E,J[9]=-W*k,J[2]=G-Z*E,J[6]=X+U*E,J[10]=K*k}else if($.order==="YXZ"){let Z=k*w,U=k*R,X=E*w,G=E*R;J[0]=Z+G*W,J[4]=X*W-U,J[8]=K*E,J[1]=K*R,J[5]=K*w,J[9]=-W,J[2]=U*W-X,J[6]=G+Z*W,J[10]=K*k}else if($.order==="ZXY"){let Z=k*w,U=k*R,X=E*w,G=E*R;J[0]=Z-G*W,J[4]=-K*R,J[8]=X+U*W,J[1]=U+X*W,J[5]=K*w,J[9]=G-Z*W,J[2]=-K*E,J[6]=W,J[10]=K*k}else if($.order==="ZYX"){let Z=K*w,U=K*R,X=W*w,G=W*R;J[0]=k*w,J[4]=X*E-U,J[8]=Z*E+G,J[1]=k*R,J[5]=G*E+Z,J[9]=U*E-X,J[2]=-E,J[6]=W*k,J[10]=K*k}else if($.order==="YZX"){let Z=K*k,U=K*E,X=W*k,G=W*E;J[0]=k*w,J[4]=G-Z*R,J[8]=X*R+U,J[1]=R,J[5]=K*w,J[9]=-W*w,J[2]=-E*w,J[6]=U*R+X,J[10]=Z-G*R}else if($.order==="XZY"){let Z=K*k,U=K*E,X=W*k,G=W*E;J[0]=k*w,J[4]=-R,J[8]=E*w,J[1]=Z*R+G,J[5]=K*w,J[9]=U*R-X,J[2]=X*R-U,J[6]=W*w,J[10]=G*R+Z}return J[3]=0,J[7]=0,J[11]=0,J[12]=0,J[13]=0,J[14]=0,J[15]=1,this}makeRotationFromQuaternion($){return this.compose(DH,$,qH)}lookAt($,J,Q){let M=this.elements;if(x1.subVectors($,J),x1.lengthSq()===0)x1.z=1;if(x1.normalize(),T5.crossVectors(Q,x1),T5.lengthSq()===0){if(Math.abs(Q.z)===1)x1.x+=0.0001;else x1.z+=0.0001;x1.normalize(),T5.crossVectors(Q,x1)}return T5.normalize(),v6.crossVectors(x1,T5),M[0]=T5.x,M[4]=v6.x,M[8]=x1.x,M[1]=T5.y,M[5]=v6.y,M[9]=x1.y,M[2]=T5.z,M[6]=v6.z,M[10]=x1.z,this}multiply($){return this.multiplyMatrices(this,$)}premultiply($){return this.multiplyMatrices($,this)}multiplyMatrices($,J){let Q=$.elements,M=J.elements,H=this.elements,K=Q[0],W=Q[4],k=Q[8],E=Q[12],w=Q[1],R=Q[5],Z=Q[9],U=Q[13],X=Q[2],G=Q[6],q=Q[10],Y=Q[14],N=Q[3],B=Q[7],D=Q[11],V=Q[15],h=M[0],C=M[4],z=M[8],y=M[12],P=M[1],F=M[5],f=M[9],u=M[13],x=M[2],c=M[6],t=M[10],d=M[14],e=M[3],g=M[7],W0=M[11],w0=M[15];return H[0]=K*h+W*P+k*x+E*e,H[4]=K*C+W*F+k*c+E*g,H[8]=K*z+W*f+k*t+E*W0,H[12]=K*y+W*u+k*d+E*w0,H[1]=w*h+R*P+Z*x+U*e,H[5]=w*C+R*F+Z*c+U*g,H[9]=w*z+R*f+Z*t+U*W0,H[13]=w*y+R*u+Z*d+U*w0,H[2]=X*h+G*P+q*x+Y*e,H[6]=X*C+G*F+q*c+Y*g,H[10]=X*z+G*f+q*t+Y*W0,H[14]=X*y+G*u+q*d+Y*w0,H[3]=N*h+B*P+D*x+V*e,H[7]=N*C+B*F+D*c+V*g,H[11]=N*z+B*f+D*t+V*W0,H[15]=N*y+B*u+D*d+V*w0,this}multiplyScalar($){let J=this.elements;return J[0]*=$,J[4]*=$,J[8]*=$,J[12]*=$,J[1]*=$,J[5]*=$,J[9]*=$,J[13]*=$,J[2]*=$,J[6]*=$,J[10]*=$,J[14]*=$,J[3]*=$,J[7]*=$,J[11]*=$,J[15]*=$,this}determinant(){let $=this.elements,J=$[0],Q=$[4],M=$[8],H=$[12],K=$[1],W=$[5],k=$[9],E=$[13],w=$[2],R=$[6],Z=$[10],U=$[14],X=$[3],G=$[7],q=$[11],Y=$[15];return X*(+H*k*R-M*E*R-H*W*Z+Q*E*Z+M*W*U-Q*k*U)+G*(+J*k*U-J*E*Z+H*K*Z-M*K*U+M*E*w-H*k*w)+q*(+J*E*R-J*W*U-H*K*R+Q*K*U+H*W*w-Q*E*w)+Y*(-M*W*w-J*k*R+J*W*Z+M*K*R-Q*K*Z+Q*k*w)}transpose(){let $=this.elements,J;return J=$[1],$[1]=$[4],$[4]=J,J=$[2],$[2]=$[8],$[8]=J,J=$[6],$[6]=$[9],$[9]=J,J=$[3],$[3]=$[12],$[12]=J,J=$[7],$[7]=$[13],$[13]=J,J=$[11],$[11]=$[14],$[14]=J,this}setPosition($,J,Q){let M=this.elements;if($.isVector3)M[12]=$.x,M[13]=$.y,M[14]=$.z;else M[12]=$,M[13]=J,M[14]=Q;return this}invert(){let $=this.elements,J=$[0],Q=$[1],M=$[2],H=$[3],K=$[4],W=$[5],k=$[6],E=$[7],w=$[8],R=$[9],Z=$[10],U=$[11],X=$[12],G=$[13],q=$[14],Y=$[15],N=R*q*E-G*Z*E+G*k*U-W*q*U-R*k*Y+W*Z*Y,B=X*Z*E-w*q*E-X*k*U+K*q*U+w*k*Y-K*Z*Y,D=w*G*E-X*R*E+X*W*U-K*G*U-w*W*Y+K*R*Y,V=X*R*k-w*G*k-X*W*Z+K*G*Z+w*W*q-K*R*q,h=J*N+Q*B+M*D+H*V;if(h===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let C=1/h;return $[0]=N*C,$[1]=(G*Z*H-R*q*H-G*M*U+Q*q*U+R*M*Y-Q*Z*Y)*C,$[2]=(W*q*H-G*k*H+G*M*E-Q*q*E-W*M*Y+Q*k*Y)*C,$[3]=(R*k*H-W*Z*H-R*M*E+Q*Z*E+W*M*U-Q*k*U)*C,$[4]=B*C,$[5]=(w*q*H-X*Z*H+X*M*U-J*q*U-w*M*Y+J*Z*Y)*C,$[6]=(X*k*H-K*q*H-X*M*E+J*q*E+K*M*Y-J*k*Y)*C,$[7]=(K*Z*H-w*k*H+w*M*E-J*Z*E-K*M*U+J*k*U)*C,$[8]=D*C,$[9]=(X*R*H-w*G*H-X*Q*U+J*G*U+w*Q*Y-J*R*Y)*C,$[10]=(K*G*H-X*W*H+X*Q*E-J*G*E-K*Q*Y+J*W*Y)*C,$[11]=(w*W*H-K*R*H-w*Q*E+J*R*E+K*Q*U-J*W*U)*C,$[12]=V*C,$[13]=(w*G*M-X*R*M+X*Q*Z-J*G*Z-w*Q*q+J*R*q)*C,$[14]=(X*W*M-K*G*M-X*Q*k+J*G*k+K*Q*q-J*W*q)*C,$[15]=(K*R*M-w*W*M+w*Q*k-J*R*k-K*Q*Z+J*W*Z)*C,this}scale($){let J=this.elements,Q=$.x,M=$.y,H=$.z;return J[0]*=Q,J[4]*=M,J[8]*=H,J[1]*=Q,J[5]*=M,J[9]*=H,J[2]*=Q,J[6]*=M,J[10]*=H,J[3]*=Q,J[7]*=M,J[11]*=H,this}getMaxScaleOnAxis(){let $=this.elements,J=$[0]*$[0]+$[1]*$[1]+$[2]*$[2],Q=$[4]*$[4]+$[5]*$[5]+$[6]*$[6],M=$[8]*$[8]+$[9]*$[9]+$[10]*$[10];return Math.sqrt(Math.max(J,Q,M))}makeTranslation($,J,Q){if($.isVector3)this.set(1,0,0,$.x,0,1,0,$.y,0,0,1,$.z,0,0,0,1);else this.set(1,0,0,$,0,1,0,J,0,0,1,Q,0,0,0,1);return this}makeRotationX($){let J=Math.cos($),Q=Math.sin($);return this.set(1,0,0,0,0,J,-Q,0,0,Q,J,0,0,0,0,1),this}makeRotationY($){let J=Math.cos($),Q=Math.sin($);return this.set(J,0,Q,0,0,1,0,0,-Q,0,J,0,0,0,0,1),this}makeRotationZ($){let J=Math.cos($),Q=Math.sin($);return this.set(J,-Q,0,0,Q,J,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis($,J){let Q=Math.cos(J),M=Math.sin(J),H=1-Q,K=$.x,W=$.y,k=$.z,E=H*K,w=H*W;return this.set(E*K+Q,E*W-M*k,E*k+M*W,0,E*W+M*k,w*W+Q,w*k-M*K,0,E*k-M*W,w*k+M*K,H*k*k+Q,0,0,0,0,1),this}makeScale($,J,Q){return this.set($,0,0,0,0,J,0,0,0,0,Q,0,0,0,0,1),this}makeShear($,J,Q,M,H,K){return this.set(1,Q,H,0,$,1,K,0,J,M,1,0,0,0,0,1),this}compose($,J,Q){let M=this.elements,H=J._x,K=J._y,W=J._z,k=J._w,E=H+H,w=K+K,R=W+W,Z=H*E,U=H*w,X=H*R,G=K*w,q=K*R,Y=W*R,N=k*E,B=k*w,D=k*R,V=Q.x,h=Q.y,C=Q.z;return M[0]=(1-(G+Y))*V,M[1]=(U+D)*V,M[2]=(X-B)*V,M[3]=0,M[4]=(U-D)*h,M[5]=(1-(Z+Y))*h,M[6]=(q+N)*h,M[7]=0,M[8]=(X+B)*C,M[9]=(q-N)*C,M[10]=(1-(Z+G))*C,M[11]=0,M[12]=$.x,M[13]=$.y,M[14]=$.z,M[15]=1,this}decompose($,J,Q){let M=this.elements,H=G8.set(M[0],M[1],M[2]).length(),K=G8.set(M[4],M[5],M[6]).length(),W=G8.set(M[8],M[9],M[10]).length();if(this.determinant()<0)H=-H;$.x=M[12],$.y=M[13],$.z=M[14],K5.copy(this);let E=1/H,w=1/K,R=1/W;return K5.elements[0]*=E,K5.elements[1]*=E,K5.elements[2]*=E,K5.elements[4]*=w,K5.elements[5]*=w,K5.elements[6]*=w,K5.elements[8]*=R,K5.elements[9]*=R,K5.elements[10]*=R,J.setFromRotationMatrix(K5),Q.x=H,Q.y=K,Q.z=W,this}makePerspective($,J,Q,M,H,K,W=2000,k=!1){let E=this.elements,w=2*H/(J-$),R=2*H/(Q-M),Z=(J+$)/(J-$),U=(Q+M)/(Q-M),X,G;if(k)X=H/(K-H),G=K*H/(K-H);else if(W===2000)X=-(K+H)/(K-H),G=-2*K*H/(K-H);else if(W===2001)X=-K/(K-H),G=-K*H/(K-H);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+W);return E[0]=w,E[4]=0,E[8]=Z,E[12]=0,E[1]=0,E[5]=R,E[9]=U,E[13]=0,E[2]=0,E[6]=0,E[10]=X,E[14]=G,E[3]=0,E[7]=0,E[11]=-1,E[15]=0,this}makeOrthographic($,J,Q,M,H,K,W=2000,k=!1){let E=this.elements,w=2/(J-$),R=2/(Q-M),Z=-(J+$)/(J-$),U=-(Q+M)/(Q-M),X,G;if(k)X=1/(K-H),G=K/(K-H);else if(W===2000)X=-2/(K-H),G=-(K+H)/(K-H);else if(W===2001)X=-1/(K-H),G=-H/(K-H);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+W);return E[0]=w,E[4]=0,E[8]=0,E[12]=Z,E[1]=0,E[5]=R,E[9]=0,E[13]=U,E[2]=0,E[6]=0,E[10]=X,E[14]=G,E[3]=0,E[7]=0,E[11]=0,E[15]=1,this}equals($){let J=this.elements,Q=$.elements;for(let M=0;M<16;M++)if(J[M]!==Q[M])return!1;return!0}fromArray($,J=0){for(let Q=0;Q<16;Q++)this.elements[Q]=$[Q+J];return this}toArray($=[],J=0){let Q=this.elements;return $[J]=Q[0],$[J+1]=Q[1],$[J+2]=Q[2],$[J+3]=Q[3],$[J+4]=Q[4],$[J+5]=Q[5],$[J+6]=Q[6],$[J+7]=Q[7],$[J+8]=Q[8],$[J+9]=Q[9],$[J+10]=Q[10],$[J+11]=Q[11],$[J+12]=Q[12],$[J+13]=Q[13],$[J+14]=Q[14],$[J+15]=Q[15],$}}var G8=new S,K5=new M1,DH=new S(0,0,0),qH=new S(1,1,1),T5=new S,v6=new S,x1=new S,G7=new M1,D7=new m0;class d1{constructor($=0,J=0,Q=0,M=d1.DEFAULT_ORDER){this.isEuler=!0,this._x=$,this._y=J,this._z=Q,this._order=M}get x(){return this._x}set x($){this._x=$,this._onChangeCallback()}get y(){return this._y}set y($){this._y=$,this._onChangeCallback()}get z(){return this._z}set z($){this._z=$,this._onChangeCallback()}get order(){return this._order}set order($){this._order=$,this._onChangeCallback()}set($,J,Q,M=this._order){return this._x=$,this._y=J,this._z=Q,this._order=M,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy($){return this._x=$._x,this._y=$._y,this._z=$._z,this._order=$._order,this._onChangeCallback(),this}setFromRotationMatrix($,J=this._order,Q=!0){let M=$.elements,H=M[0],K=M[4],W=M[8],k=M[1],E=M[5],w=M[9],R=M[2],Z=M[6],U=M[10];switch(J){case"XYZ":if(this._y=Math.asin(n0(W,-1,1)),Math.abs(W)<0.9999999)this._x=Math.atan2(-w,U),this._z=Math.atan2(-K,H);else this._x=Math.atan2(Z,E),this._z=0;break;case"YXZ":if(this._x=Math.asin(-n0(w,-1,1)),Math.abs(w)<0.9999999)this._y=Math.atan2(W,U),this._z=Math.atan2(k,E);else this._y=Math.atan2(-R,H),this._z=0;break;case"ZXY":if(this._x=Math.asin(n0(Z,-1,1)),Math.abs(Z)<0.9999999)this._y=Math.atan2(-R,U),this._z=Math.atan2(-K,E);else this._y=0,this._z=Math.atan2(k,H);break;case"ZYX":if(this._y=Math.asin(-n0(R,-1,1)),Math.abs(R)<0.9999999)this._x=Math.atan2(Z,U),this._z=Math.atan2(k,H);else this._x=0,this._z=Math.atan2(-K,E);break;case"YZX":if(this._z=Math.asin(n0(k,-1,1)),Math.abs(k)<0.9999999)this._x=Math.atan2(-w,E),this._y=Math.atan2(-R,H);else this._x=0,this._y=Math.atan2(W,U);break;case"XZY":if(this._z=Math.asin(-n0(K,-1,1)),Math.abs(K)<0.9999999)this._x=Math.atan2(Z,E),this._y=Math.atan2(W,H);else this._x=Math.atan2(-w,U),this._y=0;break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+J)}if(this._order=J,Q===!0)this._onChangeCallback();return this}setFromQuaternion($,J,Q){return G7.makeRotationFromQuaternion($),this.setFromRotationMatrix(G7,J,Q)}setFromVector3($,J=this._order){return this.set($.x,$.y,$.z,J)}reorder($){return D7.setFromEuler(this),this.setFromQuaternion(D7,$)}equals($){return $._x===this._x&&$._y===this._y&&$._z===this._z&&$._order===this._order}fromArray($){if(this._x=$[0],this._y=$[1],this._z=$[2],$[3]!==void 0)this._order=$[3];return this._onChangeCallback(),this}toArray($=[],J=0){return $[J]=this._x,$[J+1]=this._y,$[J+2]=this._z,$[J+3]=this._order,$}_onChange($){return this._onChangeCallback=$,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}d1.DEFAULT_ORDER="XYZ";class G${constructor(){this.mask=1}set($){this.mask=(1<<$|0)>>>0}enable($){this.mask|=1<<$|0}enableAll(){this.mask=-1}toggle($){this.mask^=1<<$|0}disable($){this.mask&=~(1<<$|0)}disableAll(){this.mask=0}test($){return(this.mask&$.mask)!==0}isEnabled($){return(this.mask&(1<<$|0))!==0}}var OH=0,q7=new S,D8=new m0,F5=new M1,b6=new S,t8=new S,FH=new S,LH=new m0,O7=new S(1,0,0),F7=new S(0,1,0),L7=new S(0,0,1),P7={type:"added"},PH={type:"removed"},q8={type:"childadded",child:null},k9={type:"childremoved",child:null};class S1 extends v5{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:OH++}),this.uuid=Z6(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=S1.DEFAULT_UP.clone();let $=new S,J=new d1,Q=new m0,M=new S(1,1,1);function H(){Q.setFromEuler(J,!1)}function K(){J.setFromQuaternion(Q,void 0,!1)}J._onChange(H),Q._onChange(K),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:$},rotation:{configurable:!0,enumerable:!0,value:J},quaternion:{configurable:!0,enumerable:!0,value:Q},scale:{configurable:!0,enumerable:!0,value:M},modelViewMatrix:{value:new M1},normalMatrix:{value:new x0}}),this.matrix=new M1,this.matrixWorld=new M1,this.matrixAutoUpdate=S1.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=S1.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new G$,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4($){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply($),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion($){return this.quaternion.premultiply($),this}setRotationFromAxisAngle($,J){this.quaternion.setFromAxisAngle($,J)}setRotationFromEuler($){this.quaternion.setFromEuler($,!0)}setRotationFromMatrix($){this.quaternion.setFromRotationMatrix($)}setRotationFromQuaternion($){this.quaternion.copy($)}rotateOnAxis($,J){return D8.setFromAxisAngle($,J),this.quaternion.multiply(D8),this}rotateOnWorldAxis($,J){return D8.setFromAxisAngle($,J),this.quaternion.premultiply(D8),this}rotateX($){return this.rotateOnAxis(O7,$)}rotateY($){return this.rotateOnAxis(F7,$)}rotateZ($){return this.rotateOnAxis(L7,$)}translateOnAxis($,J){return q7.copy($).applyQuaternion(this.quaternion),this.position.add(q7.multiplyScalar(J)),this}translateX($){return this.translateOnAxis(O7,$)}translateY($){return this.translateOnAxis(F7,$)}translateZ($){return this.translateOnAxis(L7,$)}localToWorld($){return this.updateWorldMatrix(!0,!1),$.applyMatrix4(this.matrixWorld)}worldToLocal($){return this.updateWorldMatrix(!0,!1),$.applyMatrix4(F5.copy(this.matrixWorld).invert())}lookAt($,J,Q){if($.isVector3)b6.copy($);else b6.set($,J,Q);let M=this.parent;if(this.updateWorldMatrix(!0,!1),t8.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)F5.lookAt(t8,b6,this.up);else F5.lookAt(b6,t8,this.up);if(this.quaternion.setFromRotationMatrix(F5),M)F5.extractRotation(M.matrixWorld),D8.setFromRotationMatrix(F5),this.quaternion.premultiply(D8.invert())}add($){if(arguments.length>1){for(let J=0;J<arguments.length;J++)this.add(arguments[J]);return this}if($===this)return console.error("THREE.Object3D.add: object can't be added as a child of itself.",$),this;if($&&$.isObject3D)$.removeFromParent(),$.parent=this,this.children.push($),$.dispatchEvent(P7),q8.child=$,this.dispatchEvent(q8),q8.child=null;else console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",$);return this}remove($){if(arguments.length>1){for(let Q=0;Q<arguments.length;Q++)this.remove(arguments[Q]);return this}let J=this.children.indexOf($);if(J!==-1)$.parent=null,this.children.splice(J,1),$.dispatchEvent(PH),k9.child=$,this.dispatchEvent(k9),k9.child=null;return this}removeFromParent(){let $=this.parent;if($!==null)$.remove(this);return this}clear(){return this.remove(...this.children)}attach($){if(this.updateWorldMatrix(!0,!1),F5.copy(this.matrixWorld).invert(),$.parent!==null)$.parent.updateWorldMatrix(!0,!1),F5.multiply($.parent.matrixWorld);return $.applyMatrix4(F5),$.removeFromParent(),$.parent=this,this.children.push($),$.updateWorldMatrix(!1,!0),$.dispatchEvent(P7),q8.child=$,this.dispatchEvent(q8),q8.child=null,this}getObjectById($){return this.getObjectByProperty("id",$)}getObjectByName($){return this.getObjectByProperty("name",$)}getObjectByProperty($,J){if(this[$]===J)return this;for(let Q=0,M=this.children.length;Q<M;Q++){let K=this.children[Q].getObjectByProperty($,J);if(K!==void 0)return K}return}getObjectsByProperty($,J,Q=[]){if(this[$]===J)Q.push(this);let M=this.children;for(let H=0,K=M.length;H<K;H++)M[H].getObjectsByProperty($,J,Q);return Q}getWorldPosition($){return this.updateWorldMatrix(!0,!1),$.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion($){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(t8,$,FH),$}getWorldScale($){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(t8,LH,$),$}getWorldDirection($){this.updateWorldMatrix(!0,!1);let J=this.matrixWorld.elements;return $.set(J[8],J[9],J[10]).normalize()}raycast(){}traverse($){$(this);let J=this.children;for(let Q=0,M=J.length;Q<M;Q++)J[Q].traverse($)}traverseVisible($){if(this.visible===!1)return;$(this);let J=this.children;for(let Q=0,M=J.length;Q<M;Q++)J[Q].traverseVisible($)}traverseAncestors($){let J=this.parent;if(J!==null)$(J),J.traverseAncestors($)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld($){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||$){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,$=!0}let J=this.children;for(let Q=0,M=J.length;Q<M;Q++)J[Q].updateMatrixWorld($)}updateWorldMatrix($,J){let Q=this.parent;if($===!0&&Q!==null)Q.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);if(J===!0){let M=this.children;for(let H=0,K=M.length;H<K;H++)M[H].updateWorldMatrix(!1,!0)}}toJSON($){let J=$===void 0||typeof $==="string",Q={};if(J)$={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},Q.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let M={};if(M.uuid=this.uuid,M.type=this.type,this.name!=="")M.name=this.name;if(this.castShadow===!0)M.castShadow=!0;if(this.receiveShadow===!0)M.receiveShadow=!0;if(this.visible===!1)M.visible=!1;if(this.frustumCulled===!1)M.frustumCulled=!1;if(this.renderOrder!==0)M.renderOrder=this.renderOrder;if(Object.keys(this.userData).length>0)M.userData=this.userData;if(M.layers=this.layers.mask,M.matrix=this.matrix.toArray(),M.up=this.up.toArray(),this.matrixAutoUpdate===!1)M.matrixAutoUpdate=!1;if(this.isInstancedMesh){if(M.type="InstancedMesh",M.count=this.count,M.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)M.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(M.type="BatchedMesh",M.perObjectFrustumCulled=this.perObjectFrustumCulled,M.sortObjects=this.sortObjects,M.drawRanges=this._drawRanges,M.reservedRanges=this._reservedRanges,M.geometryInfo=this._geometryInfo.map((W)=>({...W,boundingBox:W.boundingBox?W.boundingBox.toJSON():void 0,boundingSphere:W.boundingSphere?W.boundingSphere.toJSON():void 0})),M.instanceInfo=this._instanceInfo.map((W)=>({...W})),M.availableInstanceIds=this._availableInstanceIds.slice(),M.availableGeometryIds=this._availableGeometryIds.slice(),M.nextIndexStart=this._nextIndexStart,M.nextVertexStart=this._nextVertexStart,M.geometryCount=this._geometryCount,M.maxInstanceCount=this._maxInstanceCount,M.maxVertexCount=this._maxVertexCount,M.maxIndexCount=this._maxIndexCount,M.geometryInitialized=this._geometryInitialized,M.matricesTexture=this._matricesTexture.toJSON($),M.indirectTexture=this._indirectTexture.toJSON($),this._colorsTexture!==null)M.colorsTexture=this._colorsTexture.toJSON($);if(this.boundingSphere!==null)M.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)M.boundingBox=this.boundingBox.toJSON()}function H(W,k){if(W[k.uuid]===void 0)W[k.uuid]=k.toJSON($);return k.uuid}if(this.isScene){if(this.background){if(this.background.isColor)M.background=this.background.toJSON();else if(this.background.isTexture)M.background=this.background.toJSON($).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)M.environment=this.environment.toJSON($).uuid}else if(this.isMesh||this.isLine||this.isPoints){M.geometry=H($.geometries,this.geometry);let W=this.geometry.parameters;if(W!==void 0&&W.shapes!==void 0){let k=W.shapes;if(Array.isArray(k))for(let E=0,w=k.length;E<w;E++){let R=k[E];H($.shapes,R)}else H($.shapes,k)}}if(this.isSkinnedMesh){if(M.bindMode=this.bindMode,M.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)H($.skeletons,this.skeleton),M.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let W=[];for(let k=0,E=this.material.length;k<E;k++)W.push(H($.materials,this.material[k]));M.material=W}else M.material=H($.materials,this.material);if(this.children.length>0){M.children=[];for(let W=0;W<this.children.length;W++)M.children.push(this.children[W].toJSON($).object)}if(this.animations.length>0){M.animations=[];for(let W=0;W<this.animations.length;W++){let k=this.animations[W];M.animations.push(H($.animations,k))}}if(J){let W=K($.geometries),k=K($.materials),E=K($.textures),w=K($.images),R=K($.shapes),Z=K($.skeletons),U=K($.animations),X=K($.nodes);if(W.length>0)Q.geometries=W;if(k.length>0)Q.materials=k;if(E.length>0)Q.textures=E;if(w.length>0)Q.images=w;if(R.length>0)Q.shapes=R;if(Z.length>0)Q.skeletons=Z;if(U.length>0)Q.animations=U;if(X.length>0)Q.nodes=X}return Q.object=M,Q;function K(W){let k=[];for(let E in W){let w=W[E];delete w.metadata,k.push(w)}return k}}clone($){return new this.constructor().copy(this,$)}copy($,J=!0){if(this.name=$.name,this.up.copy($.up),this.position.copy($.position),this.rotation.order=$.rotation.order,this.quaternion.copy($.quaternion),this.scale.copy($.scale),this.matrix.copy($.matrix),this.matrixWorld.copy($.matrixWorld),this.matrixAutoUpdate=$.matrixAutoUpdate,this.matrixWorldAutoUpdate=$.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=$.matrixWorldNeedsUpdate,this.layers.mask=$.layers.mask,this.visible=$.visible,this.castShadow=$.castShadow,this.receiveShadow=$.receiveShadow,this.frustumCulled=$.frustumCulled,this.renderOrder=$.renderOrder,this.animations=$.animations.slice(),this.userData=JSON.parse(JSON.stringify($.userData)),J===!0)for(let Q=0;Q<$.children.length;Q++){let M=$.children[Q];this.add(M.clone())}return this}}S1.DEFAULT_UP=new S(0,1,0);S1.DEFAULT_MATRIX_AUTO_UPDATE=!0;S1.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var W5=new S,L5=new S,E9=new S,P5=new S,O8=new S,F8=new S,V7=new S,w9=new S,Z9=new S,R9=new S,U9=new U1,Y9=new U1,N9=new U1;class t1{constructor($=new S,J=new S,Q=new S){this.a=$,this.b=J,this.c=Q}static getNormal($,J,Q,M){M.subVectors(Q,J),W5.subVectors($,J),M.cross(W5);let H=M.lengthSq();if(H>0)return M.multiplyScalar(1/Math.sqrt(H));return M.set(0,0,0)}static getBarycoord($,J,Q,M,H){W5.subVectors(M,J),L5.subVectors(Q,J),E9.subVectors($,J);let K=W5.dot(W5),W=W5.dot(L5),k=W5.dot(E9),E=L5.dot(L5),w=L5.dot(E9),R=K*E-W*W;if(R===0)return H.set(0,0,0),null;let Z=1/R,U=(E*k-W*w)*Z,X=(K*w-W*k)*Z;return H.set(1-U-X,X,U)}static containsPoint($,J,Q,M){if(this.getBarycoord($,J,Q,M,P5)===null)return!1;return P5.x>=0&&P5.y>=0&&P5.x+P5.y<=1}static getInterpolation($,J,Q,M,H,K,W,k){if(this.getBarycoord($,J,Q,M,P5)===null){if(k.x=0,k.y=0,"z"in k)k.z=0;if("w"in k)k.w=0;return null}return k.setScalar(0),k.addScaledVector(H,P5.x),k.addScaledVector(K,P5.y),k.addScaledVector(W,P5.z),k}static getInterpolatedAttribute($,J,Q,M,H,K){return U9.setScalar(0),Y9.setScalar(0),N9.setScalar(0),U9.fromBufferAttribute($,J),Y9.fromBufferAttribute($,Q),N9.fromBufferAttribute($,M),K.setScalar(0),K.addScaledVector(U9,H.x),K.addScaledVector(Y9,H.y),K.addScaledVector(N9,H.z),K}static isFrontFacing($,J,Q,M){return W5.subVectors(Q,J),L5.subVectors($,J),W5.cross(L5).dot(M)<0?!0:!1}set($,J,Q){return this.a.copy($),this.b.copy(J),this.c.copy(Q),this}setFromPointsAndIndices($,J,Q,M){return this.a.copy($[J]),this.b.copy($[Q]),this.c.copy($[M]),this}setFromAttributeAndIndices($,J,Q,M){return this.a.fromBufferAttribute($,J),this.b.fromBufferAttribute($,Q),this.c.fromBufferAttribute($,M),this}clone(){return new this.constructor().copy(this)}copy($){return this.a.copy($.a),this.b.copy($.b),this.c.copy($.c),this}getArea(){return W5.subVectors(this.c,this.b),L5.subVectors(this.a,this.b),W5.cross(L5).length()*0.5}getMidpoint($){return $.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal($){return t1.getNormal(this.a,this.b,this.c,$)}getPlane($){return $.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord($,J){return t1.getBarycoord($,this.a,this.b,this.c,J)}getInterpolation($,J,Q,M,H){return t1.getInterpolation($,this.a,this.b,this.c,J,Q,M,H)}containsPoint($){return t1.containsPoint($,this.a,this.b,this.c)}isFrontFacing($){return t1.isFrontFacing(this.a,this.b,this.c,$)}intersectsBox($){return $.intersectsTriangle(this)}closestPointToPoint($,J){let Q=this.a,M=this.b,H=this.c,K,W;O8.subVectors(M,Q),F8.subVectors(H,Q),w9.subVectors($,Q);let k=O8.dot(w9),E=F8.dot(w9);if(k<=0&&E<=0)return J.copy(Q);Z9.subVectors($,M);let w=O8.dot(Z9),R=F8.dot(Z9);if(w>=0&&R<=w)return J.copy(M);let Z=k*R-w*E;if(Z<=0&&k>=0&&w<=0)return K=k/(k-w),J.copy(Q).addScaledVector(O8,K);R9.subVectors($,H);let U=O8.dot(R9),X=F8.dot(R9);if(X>=0&&U<=X)return J.copy(H);let G=U*E-k*X;if(G<=0&&E>=0&&X<=0)return W=E/(E-X),J.copy(Q).addScaledVector(F8,W);let q=w*X-U*R;if(q<=0&&R-w>=0&&U-X>=0)return V7.subVectors(H,M),W=(R-w)/(R-w+(U-X)),J.copy(M).addScaledVector(V7,W);let Y=1/(q+G+Z);return K=G*Y,W=Z*Y,J.copy(Q).addScaledVector(O8,K).addScaledVector(F8,W)}equals($){return $.a.equals(this.a)&&$.b.equals(this.b)&&$.c.equals(this.c)}}var pQ={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},h5={h:0,s:0,l:0},p6={h:0,s:0,l:0};function X9($,J,Q){if(Q<0)Q+=1;if(Q>1)Q-=1;if(Q<0.16666666666666666)return $+(J-$)*6*Q;if(Q<0.5)return J;if(Q<0.6666666666666666)return $+(J-$)*6*(0.6666666666666666-Q);return $}class r0{constructor($,J,Q){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set($,J,Q)}set($,J,Q){if(J===void 0&&Q===void 0){let M=$;if(M&&M.isColor)this.copy(M);else if(typeof M==="number")this.setHex(M);else if(typeof M==="string")this.setStyle(M)}else this.setRGB($,J,Q);return this}setScalar($){return this.r=$,this.g=$,this.b=$,this}setHex($,J="srgb"){return $=Math.floor($),this.r=($>>16&255)/255,this.g=($>>8&255)/255,this.b=($&255)/255,i0.colorSpaceToWorking(this,J),this}setRGB($,J,Q,M=i0.workingColorSpace){return this.r=$,this.g=J,this.b=Q,i0.colorSpaceToWorking(this,M),this}setHSL($,J,Q,M=i0.workingColorSpace){if($=UH($,1),J=n0(J,0,1),Q=n0(Q,0,1),J===0)this.r=this.g=this.b=Q;else{let H=Q<=0.5?Q*(1+J):Q+J-Q*J,K=2*Q-H;this.r=X9(K,H,$+0.3333333333333333),this.g=X9(K,H,$),this.b=X9(K,H,$-0.3333333333333333)}return i0.colorSpaceToWorking(this,M),this}setStyle($,J="srgb"){function Q(H){if(H===void 0)return;if(parseFloat(H)<1)console.warn("THREE.Color: Alpha component of "+$+" will be ignored.")}let M;if(M=/^(\w+)\(([^\)]*)\)/.exec($)){let H,K=M[1],W=M[2];switch(K){case"rgb":case"rgba":if(H=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(W))return Q(H[4]),this.setRGB(Math.min(255,parseInt(H[1],10))/255,Math.min(255,parseInt(H[2],10))/255,Math.min(255,parseInt(H[3],10))/255,J);if(H=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(W))return Q(H[4]),this.setRGB(Math.min(100,parseInt(H[1],10))/100,Math.min(100,parseInt(H[2],10))/100,Math.min(100,parseInt(H[3],10))/100,J);break;case"hsl":case"hsla":if(H=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(W))return Q(H[4]),this.setHSL(parseFloat(H[1])/360,parseFloat(H[2])/100,parseFloat(H[3])/100,J);break;default:console.warn("THREE.Color: Unknown color model "+$)}}else if(M=/^\#([A-Fa-f\d]+)$/.exec($)){let H=M[1],K=H.length;if(K===3)return this.setRGB(parseInt(H.charAt(0),16)/15,parseInt(H.charAt(1),16)/15,parseInt(H.charAt(2),16)/15,J);else if(K===6)return this.setHex(parseInt(H,16),J);else console.warn("THREE.Color: Invalid hex color "+$)}else if($&&$.length>0)return this.setColorName($,J);return this}setColorName($,J="srgb"){let Q=pQ[$.toLowerCase()];if(Q!==void 0)this.setHex(Q,J);else console.warn("THREE.Color: Unknown color "+$);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy($){return this.r=$.r,this.g=$.g,this.b=$.b,this}copySRGBToLinear($){return this.r=V5($.r),this.g=V5($.g),this.b=V5($.b),this}copyLinearToSRGB($){return this.r=B8($.r),this.g=B8($.g),this.b=B8($.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex($="srgb"){return i0.workingToColorSpace(I1.copy(this),$),Math.round(n0(I1.r*255,0,255))*65536+Math.round(n0(I1.g*255,0,255))*256+Math.round(n0(I1.b*255,0,255))}getHexString($="srgb"){return("000000"+this.getHex($).toString(16)).slice(-6)}getHSL($,J=i0.workingColorSpace){i0.workingToColorSpace(I1.copy(this),J);let{r:Q,g:M,b:H}=I1,K=Math.max(Q,M,H),W=Math.min(Q,M,H),k,E,w=(W+K)/2;if(W===K)k=0,E=0;else{let R=K-W;switch(E=w<=0.5?R/(K+W):R/(2-K-W),K){case Q:k=(M-H)/R+(M<H?6:0);break;case M:k=(H-Q)/R+2;break;case H:k=(Q-M)/R+4;break}k/=6}return $.h=k,$.s=E,$.l=w,$}getRGB($,J=i0.workingColorSpace){return i0.workingToColorSpace(I1.copy(this),J),$.r=I1.r,$.g=I1.g,$.b=I1.b,$}getStyle($="srgb"){i0.workingToColorSpace(I1.copy(this),$);let{r:J,g:Q,b:M}=I1;if($!=="srgb")return`color(${$} ${J.toFixed(3)} ${Q.toFixed(3)} ${M.toFixed(3)})`;return`rgb(${Math.round(J*255)},${Math.round(Q*255)},${Math.round(M*255)})`}offsetHSL($,J,Q){return this.getHSL(h5),this.setHSL(h5.h+$,h5.s+J,h5.l+Q)}add($){return this.r+=$.r,this.g+=$.g,this.b+=$.b,this}addColors($,J){return this.r=$.r+J.r,this.g=$.g+J.g,this.b=$.b+J.b,this}addScalar($){return this.r+=$,this.g+=$,this.b+=$,this}sub($){return this.r=Math.max(0,this.r-$.r),this.g=Math.max(0,this.g-$.g),this.b=Math.max(0,this.b-$.b),this}multiply($){return this.r*=$.r,this.g*=$.g,this.b*=$.b,this}multiplyScalar($){return this.r*=$,this.g*=$,this.b*=$,this}lerp($,J){return this.r+=($.r-this.r)*J,this.g+=($.g-this.g)*J,this.b+=($.b-this.b)*J,this}lerpColors($,J,Q){return this.r=$.r+(J.r-$.r)*Q,this.g=$.g+(J.g-$.g)*Q,this.b=$.b+(J.b-$.b)*Q,this}lerpHSL($,J){this.getHSL(h5),$.getHSL(p6);let Q=r$(h5.h,p6.h,J),M=r$(h5.s,p6.s,J),H=r$(h5.l,p6.l,J);return this.setHSL(Q,M,H),this}setFromVector3($){return this.r=$.x,this.g=$.y,this.b=$.z,this}applyMatrix3($){let J=this.r,Q=this.g,M=this.b,H=$.elements;return this.r=H[0]*J+H[3]*Q+H[6]*M,this.g=H[1]*J+H[4]*Q+H[7]*M,this.b=H[2]*J+H[5]*Q+H[8]*M,this}equals($){return $.r===this.r&&$.g===this.g&&$.b===this.b}fromArray($,J=0){return this.r=$[J],this.g=$[J+1],this.b=$[J+2],this}toArray($=[],J=0){return $[J]=this.r,$[J+1]=this.g,$[J+2]=this.b,$}fromBufferAttribute($,J){return this.r=$.getX(J),this.g=$.getY(J),this.b=$.getZ(J),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var I1=new r0;r0.NAMES=pQ;var VH=0;class e5 extends v5{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:VH++}),this.uuid=Z6(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new r0(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest($){if(this._alphaTest>0!==$>0)this.version++;this._alphaTest=$}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues($){if($===void 0)return;for(let J in $){let Q=$[J];if(Q===void 0){console.warn(`THREE.Material: parameter '${J}' has value of undefined.`);continue}let M=this[J];if(M===void 0){console.warn(`THREE.Material: '${J}' is not a property of THREE.${this.type}.`);continue}if(M&&M.isColor)M.set(Q);else if(M&&M.isVector3&&(Q&&Q.isVector3))M.copy(Q);else this[J]=Q}}toJSON($){let J=$===void 0||typeof $==="string";if(J)$={textures:{},images:{}};let Q={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if(Q.uuid=this.uuid,Q.type=this.type,this.name!=="")Q.name=this.name;if(this.color&&this.color.isColor)Q.color=this.color.getHex();if(this.roughness!==void 0)Q.roughness=this.roughness;if(this.metalness!==void 0)Q.metalness=this.metalness;if(this.sheen!==void 0)Q.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)Q.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)Q.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)Q.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1)Q.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)Q.specular=this.specular.getHex();if(this.specularIntensity!==void 0)Q.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)Q.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)Q.shininess=this.shininess;if(this.clearcoat!==void 0)Q.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)Q.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)Q.clearcoatMap=this.clearcoatMap.toJSON($).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)Q.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON($).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)Q.clearcoatNormalMap=this.clearcoatNormalMap.toJSON($).uuid,Q.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.dispersion!==void 0)Q.dispersion=this.dispersion;if(this.iridescence!==void 0)Q.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)Q.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)Q.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)Q.iridescenceMap=this.iridescenceMap.toJSON($).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)Q.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON($).uuid;if(this.anisotropy!==void 0)Q.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)Q.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)Q.anisotropyMap=this.anisotropyMap.toJSON($).uuid;if(this.map&&this.map.isTexture)Q.map=this.map.toJSON($).uuid;if(this.matcap&&this.matcap.isTexture)Q.matcap=this.matcap.toJSON($).uuid;if(this.alphaMap&&this.alphaMap.isTexture)Q.alphaMap=this.alphaMap.toJSON($).uuid;if(this.lightMap&&this.lightMap.isTexture)Q.lightMap=this.lightMap.toJSON($).uuid,Q.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)Q.aoMap=this.aoMap.toJSON($).uuid,Q.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)Q.bumpMap=this.bumpMap.toJSON($).uuid,Q.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)Q.normalMap=this.normalMap.toJSON($).uuid,Q.normalMapType=this.normalMapType,Q.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)Q.displacementMap=this.displacementMap.toJSON($).uuid,Q.displacementScale=this.displacementScale,Q.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)Q.roughnessMap=this.roughnessMap.toJSON($).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)Q.metalnessMap=this.metalnessMap.toJSON($).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)Q.emissiveMap=this.emissiveMap.toJSON($).uuid;if(this.specularMap&&this.specularMap.isTexture)Q.specularMap=this.specularMap.toJSON($).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)Q.specularIntensityMap=this.specularIntensityMap.toJSON($).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)Q.specularColorMap=this.specularColorMap.toJSON($).uuid;if(this.envMap&&this.envMap.isTexture){if(Q.envMap=this.envMap.toJSON($).uuid,this.combine!==void 0)Q.combine=this.combine}if(this.envMapRotation!==void 0)Q.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)Q.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)Q.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)Q.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)Q.gradientMap=this.gradientMap.toJSON($).uuid;if(this.transmission!==void 0)Q.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)Q.transmissionMap=this.transmissionMap.toJSON($).uuid;if(this.thickness!==void 0)Q.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)Q.thicknessMap=this.thicknessMap.toJSON($).uuid;if(this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0)Q.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)Q.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)Q.size=this.size;if(this.shadowSide!==null)Q.shadowSide=this.shadowSide;if(this.sizeAttenuation!==void 0)Q.sizeAttenuation=this.sizeAttenuation;if(this.blending!==1)Q.blending=this.blending;if(this.side!==0)Q.side=this.side;if(this.vertexColors===!0)Q.vertexColors=!0;if(this.opacity<1)Q.opacity=this.opacity;if(this.transparent===!0)Q.transparent=!0;if(this.blendSrc!==204)Q.blendSrc=this.blendSrc;if(this.blendDst!==205)Q.blendDst=this.blendDst;if(this.blendEquation!==100)Q.blendEquation=this.blendEquation;if(this.blendSrcAlpha!==null)Q.blendSrcAlpha=this.blendSrcAlpha;if(this.blendDstAlpha!==null)Q.blendDstAlpha=this.blendDstAlpha;if(this.blendEquationAlpha!==null)Q.blendEquationAlpha=this.blendEquationAlpha;if(this.blendColor&&this.blendColor.isColor)Q.blendColor=this.blendColor.getHex();if(this.blendAlpha!==0)Q.blendAlpha=this.blendAlpha;if(this.depthFunc!==3)Q.depthFunc=this.depthFunc;if(this.depthTest===!1)Q.depthTest=this.depthTest;if(this.depthWrite===!1)Q.depthWrite=this.depthWrite;if(this.colorWrite===!1)Q.colorWrite=this.colorWrite;if(this.stencilWriteMask!==255)Q.stencilWriteMask=this.stencilWriteMask;if(this.stencilFunc!==519)Q.stencilFunc=this.stencilFunc;if(this.stencilRef!==0)Q.stencilRef=this.stencilRef;if(this.stencilFuncMask!==255)Q.stencilFuncMask=this.stencilFuncMask;if(this.stencilFail!==7680)Q.stencilFail=this.stencilFail;if(this.stencilZFail!==7680)Q.stencilZFail=this.stencilZFail;if(this.stencilZPass!==7680)Q.stencilZPass=this.stencilZPass;if(this.stencilWrite===!0)Q.stencilWrite=this.stencilWrite;if(this.rotation!==void 0&&this.rotation!==0)Q.rotation=this.rotation;if(this.polygonOffset===!0)Q.polygonOffset=!0;if(this.polygonOffsetFactor!==0)Q.polygonOffsetFactor=this.polygonOffsetFactor;if(this.polygonOffsetUnits!==0)Q.polygonOffsetUnits=this.polygonOffsetUnits;if(this.linewidth!==void 0&&this.linewidth!==1)Q.linewidth=this.linewidth;if(this.dashSize!==void 0)Q.dashSize=this.dashSize;if(this.gapSize!==void 0)Q.gapSize=this.gapSize;if(this.scale!==void 0)Q.scale=this.scale;if(this.dithering===!0)Q.dithering=!0;if(this.alphaTest>0)Q.alphaTest=this.alphaTest;if(this.alphaHash===!0)Q.alphaHash=!0;if(this.alphaToCoverage===!0)Q.alphaToCoverage=!0;if(this.premultipliedAlpha===!0)Q.premultipliedAlpha=!0;if(this.forceSinglePass===!0)Q.forceSinglePass=!0;if(this.wireframe===!0)Q.wireframe=!0;if(this.wireframeLinewidth>1)Q.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!=="round")Q.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!=="round")Q.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading===!0)Q.flatShading=!0;if(this.visible===!1)Q.visible=!1;if(this.toneMapped===!1)Q.toneMapped=!1;if(this.fog===!1)Q.fog=!1;if(Object.keys(this.userData).length>0)Q.userData=this.userData;function M(H){let K=[];for(let W in H){let k=H[W];delete k.metadata,K.push(k)}return K}if(J){let H=M($.textures),K=M($.images);if(H.length>0)Q.textures=H;if(K.length>0)Q.images=K}return Q}clone(){return new this.constructor().copy(this)}copy($){this.name=$.name,this.blending=$.blending,this.side=$.side,this.vertexColors=$.vertexColors,this.opacity=$.opacity,this.transparent=$.transparent,this.blendSrc=$.blendSrc,this.blendDst=$.blendDst,this.blendEquation=$.blendEquation,this.blendSrcAlpha=$.blendSrcAlpha,this.blendDstAlpha=$.blendDstAlpha,this.blendEquationAlpha=$.blendEquationAlpha,this.blendColor.copy($.blendColor),this.blendAlpha=$.blendAlpha,this.depthFunc=$.depthFunc,this.depthTest=$.depthTest,this.depthWrite=$.depthWrite,this.stencilWriteMask=$.stencilWriteMask,this.stencilFunc=$.stencilFunc,this.stencilRef=$.stencilRef,this.stencilFuncMask=$.stencilFuncMask,this.stencilFail=$.stencilFail,this.stencilZFail=$.stencilZFail,this.stencilZPass=$.stencilZPass,this.stencilWrite=$.stencilWrite;let J=$.clippingPlanes,Q=null;if(J!==null){let M=J.length;Q=Array(M);for(let H=0;H!==M;++H)Q[H]=J[H].clone()}return this.clippingPlanes=Q,this.clipIntersection=$.clipIntersection,this.clipShadows=$.clipShadows,this.shadowSide=$.shadowSide,this.colorWrite=$.colorWrite,this.precision=$.precision,this.polygonOffset=$.polygonOffset,this.polygonOffsetFactor=$.polygonOffsetFactor,this.polygonOffsetUnits=$.polygonOffsetUnits,this.dithering=$.dithering,this.alphaTest=$.alphaTest,this.alphaHash=$.alphaHash,this.alphaToCoverage=$.alphaToCoverage,this.premultipliedAlpha=$.premultipliedAlpha,this.forceSinglePass=$.forceSinglePass,this.visible=$.visible,this.toneMapped=$.toneMapped,this.userData=JSON.parse(JSON.stringify($.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate($){if($===!0)this.version++}}class D$ extends e5{constructor($){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new r0(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new d1,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues($)}copy($){return super.copy($),this.color.copy($.color),this.map=$.map,this.lightMap=$.lightMap,this.lightMapIntensity=$.lightMapIntensity,this.aoMap=$.aoMap,this.aoMapIntensity=$.aoMapIntensity,this.specularMap=$.specularMap,this.alphaMap=$.alphaMap,this.envMap=$.envMap,this.envMapRotation.copy($.envMapRotation),this.combine=$.combine,this.reflectivity=$.reflectivity,this.refractionRatio=$.refractionRatio,this.wireframe=$.wireframe,this.wireframeLinewidth=$.wireframeLinewidth,this.wireframeLinecap=$.wireframeLinecap,this.wireframeLinejoin=$.wireframeLinejoin,this.fog=$.fog,this}}var Y1=new S,x6=new $1,zH=0;class N1{constructor($,J,Q=!1){if(Array.isArray($))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:zH++}),this.name="",this.array=$,this.itemSize=J,this.count=$!==void 0?$.length/J:0,this.normalized=Q,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate($){if($===!0)this.version++}setUsage($){return this.usage=$,this}addUpdateRange($,J){this.updateRanges.push({start:$,count:J})}clearUpdateRanges(){this.updateRanges.length=0}copy($){return this.name=$.name,this.array=new $.array.constructor($.array),this.itemSize=$.itemSize,this.count=$.count,this.normalized=$.normalized,this.usage=$.usage,this.gpuType=$.gpuType,this}copyAt($,J,Q){$*=this.itemSize,Q*=J.itemSize;for(let M=0,H=this.itemSize;M<H;M++)this.array[$+M]=J.array[Q+M];return this}copyArray($){return this.array.set($),this}applyMatrix3($){if(this.itemSize===2)for(let J=0,Q=this.count;J<Q;J++)x6.fromBufferAttribute(this,J),x6.applyMatrix3($),this.setXY(J,x6.x,x6.y);else if(this.itemSize===3)for(let J=0,Q=this.count;J<Q;J++)Y1.fromBufferAttribute(this,J),Y1.applyMatrix3($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}applyMatrix4($){for(let J=0,Q=this.count;J<Q;J++)Y1.fromBufferAttribute(this,J),Y1.applyMatrix4($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}applyNormalMatrix($){for(let J=0,Q=this.count;J<Q;J++)Y1.fromBufferAttribute(this,J),Y1.applyNormalMatrix($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}transformDirection($){for(let J=0,Q=this.count;J<Q;J++)Y1.fromBufferAttribute(this,J),Y1.transformDirection($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}set($,J=0){return this.array.set($,J),this}getComponent($,J){let Q=this.array[$*this.itemSize+J];if(this.normalized)Q=i8(Q,this.array);return Q}setComponent($,J,Q){if(this.normalized)Q=h1(Q,this.array);return this.array[$*this.itemSize+J]=Q,this}getX($){let J=this.array[$*this.itemSize];if(this.normalized)J=i8(J,this.array);return J}setX($,J){if(this.normalized)J=h1(J,this.array);return this.array[$*this.itemSize]=J,this}getY($){let J=this.array[$*this.itemSize+1];if(this.normalized)J=i8(J,this.array);return J}setY($,J){if(this.normalized)J=h1(J,this.array);return this.array[$*this.itemSize+1]=J,this}getZ($){let J=this.array[$*this.itemSize+2];if(this.normalized)J=i8(J,this.array);return J}setZ($,J){if(this.normalized)J=h1(J,this.array);return this.array[$*this.itemSize+2]=J,this}getW($){let J=this.array[$*this.itemSize+3];if(this.normalized)J=i8(J,this.array);return J}setW($,J){if(this.normalized)J=h1(J,this.array);return this.array[$*this.itemSize+3]=J,this}setXY($,J,Q){if($*=this.itemSize,this.normalized)J=h1(J,this.array),Q=h1(Q,this.array);return this.array[$+0]=J,this.array[$+1]=Q,this}setXYZ($,J,Q,M){if($*=this.itemSize,this.normalized)J=h1(J,this.array),Q=h1(Q,this.array),M=h1(M,this.array);return this.array[$+0]=J,this.array[$+1]=Q,this.array[$+2]=M,this}setXYZW($,J,Q,M,H){if($*=this.itemSize,this.normalized)J=h1(J,this.array),Q=h1(Q,this.array),M=h1(M,this.array),H=h1(H,this.array);return this.array[$+0]=J,this.array[$+1]=Q,this.array[$+2]=M,this.array[$+3]=H,this}onUpload($){return this.onUploadCallback=$,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let $={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};if(this.name!=="")$.name=this.name;if(this.usage!==35044)$.usage=this.usage;return $}}class q$ extends N1{constructor($,J,Q){super(new Uint16Array($),J,Q)}}class O$ extends N1{constructor($,J,Q){super(new Uint32Array($),J,Q)}}class l1 extends N1{constructor($,J,Q){super(new Float32Array($),J,Q)}}var BH=0,a1=new M1,G9=new S1,L8=new S,g1=new t5,e8=new t5,O1=new S;class n1 extends v5{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:BH++}),this.uuid=Z6(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex($){if(Array.isArray($))this.index=new((kJ($))?O$:q$)($,1);else this.index=$;return this}setIndirect($){return this.indirect=$,this}getIndirect(){return this.indirect}getAttribute($){return this.attributes[$]}setAttribute($,J){return this.attributes[$]=J,this}deleteAttribute($){return delete this.attributes[$],this}hasAttribute($){return this.attributes[$]!==void 0}addGroup($,J,Q=0){this.groups.push({start:$,count:J,materialIndex:Q})}clearGroups(){this.groups=[]}setDrawRange($,J){this.drawRange.start=$,this.drawRange.count=J}applyMatrix4($){let J=this.attributes.position;if(J!==void 0)J.applyMatrix4($),J.needsUpdate=!0;let Q=this.attributes.normal;if(Q!==void 0){let H=new x0().getNormalMatrix($);Q.applyNormalMatrix(H),Q.needsUpdate=!0}let M=this.attributes.tangent;if(M!==void 0)M.transformDirection($),M.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this}applyQuaternion($){return a1.makeRotationFromQuaternion($),this.applyMatrix4(a1),this}rotateX($){return a1.makeRotationX($),this.applyMatrix4(a1),this}rotateY($){return a1.makeRotationY($),this.applyMatrix4(a1),this}rotateZ($){return a1.makeRotationZ($),this.applyMatrix4(a1),this}translate($,J,Q){return a1.makeTranslation($,J,Q),this.applyMatrix4(a1),this}scale($,J,Q){return a1.makeScale($,J,Q),this.applyMatrix4(a1),this}lookAt($){return G9.lookAt($),G9.updateMatrix(),this.applyMatrix4(G9.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(L8).negate(),this.translate(L8.x,L8.y,L8.z),this}setFromPoints($){let J=this.getAttribute("position");if(J===void 0){let Q=[];for(let M=0,H=$.length;M<H;M++){let K=$[M];Q.push(K.x,K.y,K.z||0)}this.setAttribute("position",new l1(Q,3))}else{let Q=Math.min($.length,J.count);for(let M=0;M<Q;M++){let H=$[M];J.setXYZ(M,H.x,H.y,H.z||0)}if($.length>J.count)console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");J.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new t5;let $=this.attributes.position,J=this.morphAttributes.position;if($&&$.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new S(-1/0,-1/0,-1/0),new S(1/0,1/0,1/0));return}if($!==void 0){if(this.boundingBox.setFromBufferAttribute($),J)for(let Q=0,M=J.length;Q<M;Q++){let H=J[Q];if(g1.setFromBufferAttribute(H),this.morphTargetsRelative)O1.addVectors(this.boundingBox.min,g1.min),this.boundingBox.expandByPoint(O1),O1.addVectors(this.boundingBox.max,g1.max),this.boundingBox.expandByPoint(O1);else this.boundingBox.expandByPoint(g1.min),this.boundingBox.expandByPoint(g1.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new b5;let $=this.attributes.position,J=this.morphAttributes.position;if($&&$.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new S,1/0);return}if($){let Q=this.boundingSphere.center;if(g1.setFromBufferAttribute($),J)for(let H=0,K=J.length;H<K;H++){let W=J[H];if(e8.setFromBufferAttribute(W),this.morphTargetsRelative)O1.addVectors(g1.min,e8.min),g1.expandByPoint(O1),O1.addVectors(g1.max,e8.max),g1.expandByPoint(O1);else g1.expandByPoint(e8.min),g1.expandByPoint(e8.max)}g1.getCenter(Q);let M=0;for(let H=0,K=$.count;H<K;H++)O1.fromBufferAttribute($,H),M=Math.max(M,Q.distanceToSquared(O1));if(J)for(let H=0,K=J.length;H<K;H++){let W=J[H],k=this.morphTargetsRelative;for(let E=0,w=W.count;E<w;E++){if(O1.fromBufferAttribute(W,E),k)L8.fromBufferAttribute($,E),O1.add(L8);M=Math.max(M,Q.distanceToSquared(O1))}}if(this.boundingSphere.radius=Math.sqrt(M),isNaN(this.boundingSphere.radius))console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let $=this.index,J=this.attributes;if($===null||J.position===void 0||J.normal===void 0||J.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:Q,normal:M,uv:H}=J;if(this.hasAttribute("tangent")===!1)this.setAttribute("tangent",new N1(new Float32Array(4*Q.count),4));let K=this.getAttribute("tangent"),W=[],k=[];for(let z=0;z<Q.count;z++)W[z]=new S,k[z]=new S;let E=new S,w=new S,R=new S,Z=new $1,U=new $1,X=new $1,G=new S,q=new S;function Y(z,y,P){E.fromBufferAttribute(Q,z),w.fromBufferAttribute(Q,y),R.fromBufferAttribute(Q,P),Z.fromBufferAttribute(H,z),U.fromBufferAttribute(H,y),X.fromBufferAttribute(H,P),w.sub(E),R.sub(E),U.sub(Z),X.sub(Z);let F=1/(U.x*X.y-X.x*U.y);if(!isFinite(F))return;G.copy(w).multiplyScalar(X.y).addScaledVector(R,-U.y).multiplyScalar(F),q.copy(R).multiplyScalar(U.x).addScaledVector(w,-X.x).multiplyScalar(F),W[z].add(G),W[y].add(G),W[P].add(G),k[z].add(q),k[y].add(q),k[P].add(q)}let N=this.groups;if(N.length===0)N=[{start:0,count:$.count}];for(let z=0,y=N.length;z<y;++z){let P=N[z],F=P.start,f=P.count;for(let u=F,x=F+f;u<x;u+=3)Y($.getX(u+0),$.getX(u+1),$.getX(u+2))}let B=new S,D=new S,V=new S,h=new S;function C(z){V.fromBufferAttribute(M,z),h.copy(V);let y=W[z];B.copy(y),B.sub(V.multiplyScalar(V.dot(y))).normalize(),D.crossVectors(h,y);let F=D.dot(k[z])<0?-1:1;K.setXYZW(z,B.x,B.y,B.z,F)}for(let z=0,y=N.length;z<y;++z){let P=N[z],F=P.start,f=P.count;for(let u=F,x=F+f;u<x;u+=3)C($.getX(u+0)),C($.getX(u+1)),C($.getX(u+2))}}computeVertexNormals(){let $=this.index,J=this.getAttribute("position");if(J!==void 0){let Q=this.getAttribute("normal");if(Q===void 0)Q=new N1(new Float32Array(J.count*3),3),this.setAttribute("normal",Q);else for(let Z=0,U=Q.count;Z<U;Z++)Q.setXYZ(Z,0,0,0);let M=new S,H=new S,K=new S,W=new S,k=new S,E=new S,w=new S,R=new S;if($)for(let Z=0,U=$.count;Z<U;Z+=3){let X=$.getX(Z+0),G=$.getX(Z+1),q=$.getX(Z+2);M.fromBufferAttribute(J,X),H.fromBufferAttribute(J,G),K.fromBufferAttribute(J,q),w.subVectors(K,H),R.subVectors(M,H),w.cross(R),W.fromBufferAttribute(Q,X),k.fromBufferAttribute(Q,G),E.fromBufferAttribute(Q,q),W.add(w),k.add(w),E.add(w),Q.setXYZ(X,W.x,W.y,W.z),Q.setXYZ(G,k.x,k.y,k.z),Q.setXYZ(q,E.x,E.y,E.z)}else for(let Z=0,U=J.count;Z<U;Z+=3)M.fromBufferAttribute(J,Z+0),H.fromBufferAttribute(J,Z+1),K.fromBufferAttribute(J,Z+2),w.subVectors(K,H),R.subVectors(M,H),w.cross(R),Q.setXYZ(Z+0,w.x,w.y,w.z),Q.setXYZ(Z+1,w.x,w.y,w.z),Q.setXYZ(Z+2,w.x,w.y,w.z);this.normalizeNormals(),Q.needsUpdate=!0}}normalizeNormals(){let $=this.attributes.normal;for(let J=0,Q=$.count;J<Q;J++)O1.fromBufferAttribute($,J),O1.normalize(),$.setXYZ(J,O1.x,O1.y,O1.z)}toNonIndexed(){function $(W,k){let{array:E,itemSize:w,normalized:R}=W,Z=new E.constructor(k.length*w),U=0,X=0;for(let G=0,q=k.length;G<q;G++){if(W.isInterleavedBufferAttribute)U=k[G]*W.data.stride+W.offset;else U=k[G]*w;for(let Y=0;Y<w;Y++)Z[X++]=E[U++]}return new N1(Z,w,R)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let J=new n1,Q=this.index.array,M=this.attributes;for(let W in M){let k=M[W],E=$(k,Q);J.setAttribute(W,E)}let H=this.morphAttributes;for(let W in H){let k=[],E=H[W];for(let w=0,R=E.length;w<R;w++){let Z=E[w],U=$(Z,Q);k.push(U)}J.morphAttributes[W]=k}J.morphTargetsRelative=this.morphTargetsRelative;let K=this.groups;for(let W=0,k=K.length;W<k;W++){let E=K[W];J.addGroup(E.start,E.count,E.materialIndex)}return J}toJSON(){let $={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if($.uuid=this.uuid,$.type=this.type,this.name!=="")$.name=this.name;if(Object.keys(this.userData).length>0)$.userData=this.userData;if(this.parameters!==void 0){let k=this.parameters;for(let E in k)if(k[E]!==void 0)$[E]=k[E];return $}$.data={attributes:{}};let J=this.index;if(J!==null)$.data.index={type:J.array.constructor.name,array:Array.prototype.slice.call(J.array)};let Q=this.attributes;for(let k in Q){let E=Q[k];$.data.attributes[k]=E.toJSON($.data)}let M={},H=!1;for(let k in this.morphAttributes){let E=this.morphAttributes[k],w=[];for(let R=0,Z=E.length;R<Z;R++){let U=E[R];w.push(U.toJSON($.data))}if(w.length>0)M[k]=w,H=!0}if(H)$.data.morphAttributes=M,$.data.morphTargetsRelative=this.morphTargetsRelative;let K=this.groups;if(K.length>0)$.data.groups=JSON.parse(JSON.stringify(K));let W=this.boundingSphere;if(W!==null)$.data.boundingSphere=W.toJSON();return $}clone(){return new this.constructor().copy(this)}copy($){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let J={};this.name=$.name;let Q=$.index;if(Q!==null)this.setIndex(Q.clone());let M=$.attributes;for(let E in M){let w=M[E];this.setAttribute(E,w.clone(J))}let H=$.morphAttributes;for(let E in H){let w=[],R=H[E];for(let Z=0,U=R.length;Z<U;Z++)w.push(R[Z].clone(J));this.morphAttributes[E]=w}this.morphTargetsRelative=$.morphTargetsRelative;let K=$.groups;for(let E=0,w=K.length;E<w;E++){let R=K[E];this.addGroup(R.start,R.count,R.materialIndex)}let W=$.boundingBox;if(W!==null)this.boundingBox=W.clone();let k=$.boundingSphere;if(k!==null)this.boundingSphere=k.clone();return this.drawRange.start=$.drawRange.start,this.drawRange.count=$.drawRange.count,this.userData=$.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}var z7=new M1,n5=new h8,g6=new b5,B7=new S,l6=new S,d6=new S,m6=new S,D9=new S,u6=new S,I7=new S,c6=new S;class f1 extends S1{constructor($=new n1,J=new D$){super();this.isMesh=!0,this.type="Mesh",this.geometry=$,this.material=J,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy($,J){if(super.copy($,J),$.morphTargetInfluences!==void 0)this.morphTargetInfluences=$.morphTargetInfluences.slice();if($.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},$.morphTargetDictionary);return this.material=Array.isArray($.material)?$.material.slice():$.material,this.geometry=$.geometry,this}updateMorphTargets(){let J=this.geometry.morphAttributes,Q=Object.keys(J);if(Q.length>0){let M=J[Q[0]];if(M!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let H=0,K=M.length;H<K;H++){let W=M[H].name||String(H);this.morphTargetInfluences.push(0),this.morphTargetDictionary[W]=H}}}}getVertexPosition($,J){let Q=this.geometry,M=Q.attributes.position,H=Q.morphAttributes.position,K=Q.morphTargetsRelative;J.fromBufferAttribute(M,$);let W=this.morphTargetInfluences;if(H&&W){u6.set(0,0,0);for(let k=0,E=H.length;k<E;k++){let w=W[k],R=H[k];if(w===0)continue;if(D9.fromBufferAttribute(R,$),K)u6.addScaledVector(D9,w);else u6.addScaledVector(D9.sub(J),w)}J.add(u6)}return J}raycast($,J){let Q=this.geometry,M=this.material,H=this.matrixWorld;if(M===void 0)return;if(Q.boundingSphere===null)Q.computeBoundingSphere();if(g6.copy(Q.boundingSphere),g6.applyMatrix4(H),n5.copy($.ray).recast($.near),g6.containsPoint(n5.origin)===!1){if(n5.intersectSphere(g6,B7)===null)return;if(n5.origin.distanceToSquared(B7)>($.far-$.near)**2)return}if(z7.copy(H).invert(),n5.copy($.ray).applyMatrix4(z7),Q.boundingBox!==null){if(n5.intersectsBox(Q.boundingBox)===!1)return}this._computeIntersections($,J,n5)}_computeIntersections($,J,Q){let M,H=this.geometry,K=this.material,W=H.index,k=H.attributes.position,E=H.attributes.uv,w=H.attributes.uv1,R=H.attributes.normal,Z=H.groups,U=H.drawRange;if(W!==null)if(Array.isArray(K))for(let X=0,G=Z.length;X<G;X++){let q=Z[X],Y=K[q.materialIndex],N=Math.max(q.start,U.start),B=Math.min(W.count,Math.min(q.start+q.count,U.start+U.count));for(let D=N,V=B;D<V;D+=3){let h=W.getX(D),C=W.getX(D+1),z=W.getX(D+2);if(M=n6(this,Y,$,Q,E,w,R,h,C,z),M)M.faceIndex=Math.floor(D/3),M.face.materialIndex=q.materialIndex,J.push(M)}}else{let X=Math.max(0,U.start),G=Math.min(W.count,U.start+U.count);for(let q=X,Y=G;q<Y;q+=3){let N=W.getX(q),B=W.getX(q+1),D=W.getX(q+2);if(M=n6(this,K,$,Q,E,w,R,N,B,D),M)M.faceIndex=Math.floor(q/3),J.push(M)}}else if(k!==void 0)if(Array.isArray(K))for(let X=0,G=Z.length;X<G;X++){let q=Z[X],Y=K[q.materialIndex],N=Math.max(q.start,U.start),B=Math.min(k.count,Math.min(q.start+q.count,U.start+U.count));for(let D=N,V=B;D<V;D+=3){let h=D,C=D+1,z=D+2;if(M=n6(this,Y,$,Q,E,w,R,h,C,z),M)M.faceIndex=Math.floor(D/3),M.face.materialIndex=q.materialIndex,J.push(M)}}else{let X=Math.max(0,U.start),G=Math.min(k.count,U.start+U.count);for(let q=X,Y=G;q<Y;q+=3){let N=q,B=q+1,D=q+2;if(M=n6(this,K,$,Q,E,w,R,N,B,D),M)M.faceIndex=Math.floor(q/3),J.push(M)}}}}function IH($,J,Q,M,H,K,W,k){let E;if(J.side===1)E=M.intersectTriangle(W,K,H,!0,k);else E=M.intersectTriangle(H,K,W,J.side===0,k);if(E===null)return null;c6.copy(k),c6.applyMatrix4($.matrixWorld);let w=Q.ray.origin.distanceTo(c6);if(w<Q.near||w>Q.far)return null;return{distance:w,point:c6.clone(),object:$}}function n6($,J,Q,M,H,K,W,k,E,w){$.getVertexPosition(k,l6),$.getVertexPosition(E,d6),$.getVertexPosition(w,m6);let R=IH($,J,Q,M,l6,d6,m6,I7);if(R){let Z=new S;if(t1.getBarycoord(I7,l6,d6,m6,Z),H)R.uv=t1.getInterpolatedAttribute(H,k,E,w,Z,new $1);if(K)R.uv1=t1.getInterpolatedAttribute(K,k,E,w,Z,new $1);if(W){if(R.normal=t1.getInterpolatedAttribute(W,k,E,w,Z,new S),R.normal.dot(M.direction)>0)R.normal.multiplyScalar(-1)}let U={a:k,b:E,c:w,normal:new S,materialIndex:0};t1.getNormal(l6,d6,m6,U.normal),R.face=U,R.barycoord=Z}return R}class f8 extends n1{constructor($=1,J=1,Q=1,M=1,H=1,K=1){super();this.type="BoxGeometry",this.parameters={width:$,height:J,depth:Q,widthSegments:M,heightSegments:H,depthSegments:K};let W=this;M=Math.floor(M),H=Math.floor(H),K=Math.floor(K);let k=[],E=[],w=[],R=[],Z=0,U=0;X("z","y","x",-1,-1,Q,J,$,K,H,0),X("z","y","x",1,-1,Q,J,-$,K,H,1),X("x","z","y",1,1,$,Q,J,M,K,2),X("x","z","y",1,-1,$,Q,-J,M,K,3),X("x","y","z",1,-1,$,J,Q,M,H,4),X("x","y","z",-1,-1,$,J,-Q,M,H,5),this.setIndex(k),this.setAttribute("position",new l1(E,3)),this.setAttribute("normal",new l1(w,3)),this.setAttribute("uv",new l1(R,2));function X(G,q,Y,N,B,D,V,h,C,z,y){let P=D/C,F=V/z,f=D/2,u=V/2,x=h/2,c=C+1,t=z+1,d=0,e=0,g=new S;for(let W0=0;W0<t;W0++){let w0=W0*F-u;for(let z0=0;z0<c;z0++){let b0=z0*P-f;g[G]=b0*N,g[q]=w0*B,g[Y]=x,E.push(g.x,g.y,g.z),g[G]=0,g[q]=0,g[Y]=h>0?1:-1,w.push(g.x,g.y,g.z),R.push(z0/C),R.push(1-W0/z),d+=1}}for(let W0=0;W0<z;W0++)for(let w0=0;w0<C;w0++){let z0=Z+w0+c*W0,b0=Z+w0+c*(W0+1),c0=Z+(w0+1)+c*(W0+1),p=Z+(w0+1)+c*W0;k.push(z0,b0,p),k.push(b0,c0,p),e+=6}W.addGroup(U,e,y),U+=e,Z+=d}}copy($){return super.copy($),this.parameters=Object.assign({},$.parameters),this}static fromJSON($){return new f8($.width,$.height,$.depth,$.widthSegments,$.heightSegments,$.depthSegments)}}function $8($){let J={};for(let Q in $){J[Q]={};for(let M in $[Q]){let H=$[Q][M];if(H&&(H.isColor||H.isMatrix3||H.isMatrix4||H.isVector2||H.isVector3||H.isVector4||H.isTexture||H.isQuaternion))if(H.isRenderTargetTexture)console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),J[Q][M]=null;else J[Q][M]=H.clone();else if(Array.isArray(H))J[Q][M]=H.slice();else J[Q][M]=H}}return J}function C1($){let J={};for(let Q=0;Q<$.length;Q++){let M=$8($[Q]);for(let H in M)J[H]=M[H]}return J}function CH($){let J=[];for(let Q=0;Q<$.length;Q++)J.push($[Q].clone());return J}function RJ($){let J=$.getRenderTarget();if(J===null)return $.outputColorSpace;if(J.isXRRenderTarget===!0)return J.texture.colorSpace;return i0.workingColorSpace}var xQ={clone:$8,merge:C1},_H=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,AH=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class J5 extends e5{constructor($){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=_H,this.fragmentShader=AH,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,$!==void 0)this.setValues($)}copy($){return super.copy($),this.fragmentShader=$.fragmentShader,this.vertexShader=$.vertexShader,this.uniforms=$8($.uniforms),this.uniformsGroups=CH($.uniformsGroups),this.defines=Object.assign({},$.defines),this.wireframe=$.wireframe,this.wireframeLinewidth=$.wireframeLinewidth,this.fog=$.fog,this.lights=$.lights,this.clipping=$.clipping,this.extensions=Object.assign({},$.extensions),this.glslVersion=$.glslVersion,this}toJSON($){let J=super.toJSON($);J.glslVersion=this.glslVersion,J.uniforms={};for(let M in this.uniforms){let K=this.uniforms[M].value;if(K&&K.isTexture)J.uniforms[M]={type:"t",value:K.toJSON($).uuid};else if(K&&K.isColor)J.uniforms[M]={type:"c",value:K.getHex()};else if(K&&K.isVector2)J.uniforms[M]={type:"v2",value:K.toArray()};else if(K&&K.isVector3)J.uniforms[M]={type:"v3",value:K.toArray()};else if(K&&K.isVector4)J.uniforms[M]={type:"v4",value:K.toArray()};else if(K&&K.isMatrix3)J.uniforms[M]={type:"m3",value:K.toArray()};else if(K&&K.isMatrix4)J.uniforms[M]={type:"m4",value:K.toArray()};else J.uniforms[M]={value:K}}if(Object.keys(this.defines).length>0)J.defines=this.defines;J.vertexShader=this.vertexShader,J.fragmentShader=this.fragmentShader,J.lights=this.lights,J.clipping=this.clipping;let Q={};for(let M in this.extensions)if(this.extensions[M]===!0)Q[M]=!0;if(Object.keys(Q).length>0)J.extensions=Q;return J}}class F$ extends S1{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new M1,this.projectionMatrix=new M1,this.projectionMatrixInverse=new M1,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy($,J){return super.copy($,J),this.matrixWorldInverse.copy($.matrixWorldInverse),this.projectionMatrix.copy($.projectionMatrix),this.projectionMatrixInverse.copy($.projectionMatrixInverse),this.coordinateSystem=$.coordinateSystem,this}getWorldDirection($){return super.getWorldDirection($).negate()}updateMatrixWorld($){super.updateMatrixWorld($),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix($,J){super.updateWorldMatrix($,J),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}var f5=new S,C7=new $1,_7=new $1;class F1 extends F${constructor($=50,J=1,Q=0.1,M=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=$,this.zoom=1,this.near=Q,this.far=M,this.focus=10,this.aspect=J,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy($,J){return super.copy($,J),this.fov=$.fov,this.zoom=$.zoom,this.near=$.near,this.far=$.far,this.focus=$.focus,this.aspect=$.aspect,this.view=$.view===null?null:Object.assign({},$.view),this.filmGauge=$.filmGauge,this.filmOffset=$.filmOffset,this}setFocalLength($){let J=0.5*this.getFilmHeight()/$;this.fov=r6*2*Math.atan(J),this.updateProjectionMatrix()}getFocalLength(){let $=Math.tan(a$*0.5*this.fov);return 0.5*this.getFilmHeight()/$}getEffectiveFOV(){return r6*2*Math.atan(Math.tan(a$*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds($,J,Q){f5.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),J.set(f5.x,f5.y).multiplyScalar(-$/f5.z),f5.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),Q.set(f5.x,f5.y).multiplyScalar(-$/f5.z)}getViewSize($,J){return this.getViewBounds($,C7,_7),J.subVectors(_7,C7)}setViewOffset($,J,Q,M,H,K){if(this.aspect=$/J,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=$,this.view.fullHeight=J,this.view.offsetX=Q,this.view.offsetY=M,this.view.width=H,this.view.height=K,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let $=this.near,J=$*Math.tan(a$*0.5*this.fov)/this.zoom,Q=2*J,M=this.aspect*Q,H=-0.5*M,K=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:k,fullHeight:E}=K;H+=K.offsetX*M/k,J-=K.offsetY*Q/E,M*=K.width/k,Q*=K.height/E}let W=this.filmOffset;if(W!==0)H+=$*W/this.getFilmWidth();this.projectionMatrix.makePerspective(H,H+M,J,J-Q,$,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON($){let J=super.toJSON($);if(J.object.fov=this.fov,J.object.zoom=this.zoom,J.object.near=this.near,J.object.far=this.far,J.object.focus=this.focus,J.object.aspect=this.aspect,this.view!==null)J.object.view=Object.assign({},this.view);return J.object.filmGauge=this.filmGauge,J.object.filmOffset=this.filmOffset,J}}var P8=-90,V8=1;class UJ extends S1{constructor($,J,Q){super();this.type="CubeCamera",this.renderTarget=Q,this.coordinateSystem=null,this.activeMipmapLevel=0;let M=new F1(P8,V8,$,J);M.layers=this.layers,this.add(M);let H=new F1(P8,V8,$,J);H.layers=this.layers,this.add(H);let K=new F1(P8,V8,$,J);K.layers=this.layers,this.add(K);let W=new F1(P8,V8,$,J);W.layers=this.layers,this.add(W);let k=new F1(P8,V8,$,J);k.layers=this.layers,this.add(k);let E=new F1(P8,V8,$,J);E.layers=this.layers,this.add(E)}updateCoordinateSystem(){let $=this.coordinateSystem,J=this.children.concat(),[Q,M,H,K,W,k]=J;for(let E of J)this.remove(E);if($===2000)Q.up.set(0,1,0),Q.lookAt(1,0,0),M.up.set(0,1,0),M.lookAt(-1,0,0),H.up.set(0,0,-1),H.lookAt(0,1,0),K.up.set(0,0,1),K.lookAt(0,-1,0),W.up.set(0,1,0),W.lookAt(0,0,1),k.up.set(0,1,0),k.lookAt(0,0,-1);else if($===2001)Q.up.set(0,-1,0),Q.lookAt(-1,0,0),M.up.set(0,-1,0),M.lookAt(1,0,0),H.up.set(0,0,1),H.lookAt(0,1,0),K.up.set(0,0,-1),K.lookAt(0,-1,0),W.up.set(0,-1,0),W.lookAt(0,0,1),k.up.set(0,-1,0),k.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+$);for(let E of J)this.add(E),E.updateMatrixWorld()}update($,J){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:Q,activeMipmapLevel:M}=this;if(this.coordinateSystem!==$.coordinateSystem)this.coordinateSystem=$.coordinateSystem,this.updateCoordinateSystem();let[H,K,W,k,E,w]=this.children,R=$.getRenderTarget(),Z=$.getActiveCubeFace(),U=$.getActiveMipmapLevel(),X=$.xr.enabled;$.xr.enabled=!1;let G=Q.texture.generateMipmaps;Q.texture.generateMipmaps=!1,$.setRenderTarget(Q,0,M),$.render(J,H),$.setRenderTarget(Q,1,M),$.render(J,K),$.setRenderTarget(Q,2,M),$.render(J,W),$.setRenderTarget(Q,3,M),$.render(J,k),$.setRenderTarget(Q,4,M),$.render(J,E),Q.texture.generateMipmaps=G,$.setRenderTarget(Q,5,M),$.render(J,w),$.setRenderTarget(R,Z,U),$.xr.enabled=X,Q.texture.needsPMREMUpdate=!0}}class L$ extends A1{constructor($=[],J=301,Q,M,H,K,W,k,E,w){super($,J,Q,M,H,K,W,k,E,w);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images($){this.image=$}}class YJ extends $5{constructor($=1,J={}){super($,$,J);this.isWebGLCubeRenderTarget=!0;let Q={width:$,height:$,depth:1},M=[Q,Q,Q,Q,Q,Q];this.texture=new L$(M),this._setTextureOptions(J),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture($,J){this.texture.type=J.type,this.texture.colorSpace=J.colorSpace,this.texture.generateMipmaps=J.generateMipmaps,this.texture.minFilter=J.minFilter,this.texture.magFilter=J.magFilter;let Q={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},M=new f8(5,5,5),H=new J5({name:"CubemapFromEquirect",uniforms:$8(Q.uniforms),vertexShader:Q.vertexShader,fragmentShader:Q.fragmentShader,side:1,blending:0});H.uniforms.tEquirect.value=J;let K=new f1(M,H),W=J.minFilter;if(J.minFilter===1008)J.minFilter=1006;return new UJ(1,10,this).update($,K),J.minFilter=W,K.geometry.dispose(),K.material.dispose(),this}clear($,J=!0,Q=!0,M=!0){let H=$.getRenderTarget();for(let K=0;K<6;K++)$.setRenderTarget(this,K),$.clear(J,Q,M);$.setRenderTarget(H)}}class z8 extends S1{constructor(){super();this.isGroup=!0,this.type="Group"}}var SH={type:"move"};class U6{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new z8,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new z8,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new S,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new S;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new z8,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new S,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new S;return this._grip}dispatchEvent($){if(this._targetRay!==null)this._targetRay.dispatchEvent($);if(this._grip!==null)this._grip.dispatchEvent($);if(this._hand!==null)this._hand.dispatchEvent($);return this}connect($){if($&&$.hand){let J=this._hand;if(J)for(let Q of $.hand.values())this._getHandJoint(J,Q)}return this.dispatchEvent({type:"connected",data:$}),this}disconnect($){if(this.dispatchEvent({type:"disconnected",data:$}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update($,J,Q){let M=null,H=null,K=null,W=this._targetRay,k=this._grip,E=this._hand;if($&&J.session.visibilityState!=="visible-blurred"){if(E&&$.hand){K=!0;for(let G of $.hand.values()){let q=J.getJointPose(G,Q),Y=this._getHandJoint(E,G);if(q!==null)Y.matrix.fromArray(q.transform.matrix),Y.matrix.decompose(Y.position,Y.rotation,Y.scale),Y.matrixWorldNeedsUpdate=!0,Y.jointRadius=q.radius;Y.visible=q!==null}let w=E.joints["index-finger-tip"],R=E.joints["thumb-tip"],Z=w.position.distanceTo(R.position),U=0.02,X=0.005;if(E.inputState.pinching&&Z>U+X)E.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:$.handedness,target:this});else if(!E.inputState.pinching&&Z<=U-X)E.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:$.handedness,target:this})}else if(k!==null&&$.gripSpace){if(H=J.getPose($.gripSpace,Q),H!==null){if(k.matrix.fromArray(H.transform.matrix),k.matrix.decompose(k.position,k.rotation,k.scale),k.matrixWorldNeedsUpdate=!0,H.linearVelocity)k.hasLinearVelocity=!0,k.linearVelocity.copy(H.linearVelocity);else k.hasLinearVelocity=!1;if(H.angularVelocity)k.hasAngularVelocity=!0,k.angularVelocity.copy(H.angularVelocity);else k.hasAngularVelocity=!1}}if(W!==null){if(M=J.getPose($.targetRaySpace,Q),M===null&&H!==null)M=H;if(M!==null){if(W.matrix.fromArray(M.transform.matrix),W.matrix.decompose(W.position,W.rotation,W.scale),W.matrixWorldNeedsUpdate=!0,M.linearVelocity)W.hasLinearVelocity=!0,W.linearVelocity.copy(M.linearVelocity);else W.hasLinearVelocity=!1;if(M.angularVelocity)W.hasAngularVelocity=!0,W.angularVelocity.copy(M.angularVelocity);else W.hasAngularVelocity=!1;this.dispatchEvent(SH)}}}if(W!==null)W.visible=M!==null;if(k!==null)k.visible=H!==null;if(E!==null)E.visible=K!==null;return this}_getHandJoint($,J){if($.joints[J.jointName]===void 0){let Q=new z8;Q.matrixAutoUpdate=!1,Q.visible=!1,$.joints[J.jointName]=Q,$.add(Q)}return $.joints[J.jointName]}}class P$ extends S1{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new d1,this.environmentIntensity=1,this.environmentRotation=new d1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy($,J){if(super.copy($,J),$.background!==null)this.background=$.background.clone();if($.environment!==null)this.environment=$.environment.clone();if($.fog!==null)this.fog=$.fog.clone();if(this.backgroundBlurriness=$.backgroundBlurriness,this.backgroundIntensity=$.backgroundIntensity,this.backgroundRotation.copy($.backgroundRotation),this.environmentIntensity=$.environmentIntensity,this.environmentRotation.copy($.environmentRotation),$.overrideMaterial!==null)this.overrideMaterial=$.overrideMaterial.clone();return this.matrixAutoUpdate=$.matrixAutoUpdate,this}toJSON($){let J=super.toJSON($);if(this.fog!==null)J.object.fog=this.fog.toJSON();if(this.backgroundBlurriness>0)J.object.backgroundBlurriness=this.backgroundBlurriness;if(this.backgroundIntensity!==1)J.object.backgroundIntensity=this.backgroundIntensity;if(J.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1)J.object.environmentIntensity=this.environmentIntensity;return J.object.environmentRotation=this.environmentRotation.toArray(),J}}var q9=new S,TH=new S,hH=new x0;class r1{constructor($=new S(1,0,0),J=0){this.isPlane=!0,this.normal=$,this.constant=J}set($,J){return this.normal.copy($),this.constant=J,this}setComponents($,J,Q,M){return this.normal.set($,J,Q),this.constant=M,this}setFromNormalAndCoplanarPoint($,J){return this.normal.copy($),this.constant=-J.dot(this.normal),this}setFromCoplanarPoints($,J,Q){let M=q9.subVectors(Q,J).cross(TH.subVectors($,J)).normalize();return this.setFromNormalAndCoplanarPoint(M,$),this}copy($){return this.normal.copy($.normal),this.constant=$.constant,this}normalize(){let $=1/this.normal.length();return this.normal.multiplyScalar($),this.constant*=$,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint($){return this.normal.dot($)+this.constant}distanceToSphere($){return this.distanceToPoint($.center)-$.radius}projectPoint($,J){return J.copy($).addScaledVector(this.normal,-this.distanceToPoint($))}intersectLine($,J){let Q=$.delta(q9),M=this.normal.dot(Q);if(M===0){if(this.distanceToPoint($.start)===0)return J.copy($.start);return null}let H=-($.start.dot(this.normal)+this.constant)/M;if(H<0||H>1)return null;return J.copy($.start).addScaledVector(Q,H)}intersectsLine($){let J=this.distanceToPoint($.start),Q=this.distanceToPoint($.end);return J<0&&Q>0||Q<0&&J>0}intersectsBox($){return $.intersectsPlane(this)}intersectsSphere($){return $.intersectsPlane(this)}coplanarPoint($){return $.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4($,J){let Q=J||hH.getNormalMatrix($),M=this.coplanarPoint(q9).applyMatrix4($),H=this.normal.applyMatrix3(Q).normalize();return this.constant=-M.dot(H),this}translate($){return this.constant-=$.dot(this.normal),this}equals($){return $.normal.equals(this.normal)&&$.constant===this.constant}clone(){return new this.constructor().copy(this)}}var s5=new b5,fH=new $1(0.5,0.5),s6=new S;class V${constructor($=new r1,J=new r1,Q=new r1,M=new r1,H=new r1,K=new r1){this.planes=[$,J,Q,M,H,K]}set($,J,Q,M,H,K){let W=this.planes;return W[0].copy($),W[1].copy(J),W[2].copy(Q),W[3].copy(M),W[4].copy(H),W[5].copy(K),this}copy($){let J=this.planes;for(let Q=0;Q<6;Q++)J[Q].copy($.planes[Q]);return this}setFromProjectionMatrix($,J=2000,Q=!1){let M=this.planes,H=$.elements,K=H[0],W=H[1],k=H[2],E=H[3],w=H[4],R=H[5],Z=H[6],U=H[7],X=H[8],G=H[9],q=H[10],Y=H[11],N=H[12],B=H[13],D=H[14],V=H[15];if(M[0].setComponents(E-K,U-w,Y-X,V-N).normalize(),M[1].setComponents(E+K,U+w,Y+X,V+N).normalize(),M[2].setComponents(E+W,U+R,Y+G,V+B).normalize(),M[3].setComponents(E-W,U-R,Y-G,V-B).normalize(),Q)M[4].setComponents(k,Z,q,D).normalize(),M[5].setComponents(E-k,U-Z,Y-q,V-D).normalize();else if(M[4].setComponents(E-k,U-Z,Y-q,V-D).normalize(),J===2000)M[5].setComponents(E+k,U+Z,Y+q,V+D).normalize();else if(J===2001)M[5].setComponents(k,Z,q,D).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+J);return this}intersectsObject($){if($.boundingSphere!==void 0){if($.boundingSphere===null)$.computeBoundingSphere();s5.copy($.boundingSphere).applyMatrix4($.matrixWorld)}else{let J=$.geometry;if(J.boundingSphere===null)J.computeBoundingSphere();s5.copy(J.boundingSphere).applyMatrix4($.matrixWorld)}return this.intersectsSphere(s5)}intersectsSprite($){s5.center.set(0,0,0);let J=fH.distanceTo($.center);return s5.radius=0.7071067811865476+J,s5.applyMatrix4($.matrixWorld),this.intersectsSphere(s5)}intersectsSphere($){let J=this.planes,Q=$.center,M=-$.radius;for(let H=0;H<6;H++)if(J[H].distanceToPoint(Q)<M)return!1;return!0}intersectsBox($){let J=this.planes;for(let Q=0;Q<6;Q++){let M=J[Q];if(s6.x=M.normal.x>0?$.max.x:$.min.x,s6.y=M.normal.y>0?$.max.y:$.min.y,s6.z=M.normal.z>0?$.max.z:$.min.z,M.distanceToPoint(s6)<0)return!1}return!0}containsPoint($){let J=this.planes;for(let Q=0;Q<6;Q++)if(J[Q].distanceToPoint($)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Y6 extends e5{constructor($){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new r0(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues($)}copy($){return super.copy($),this.color.copy($.color),this.map=$.map,this.linewidth=$.linewidth,this.linecap=$.linecap,this.linejoin=$.linejoin,this.fog=$.fog,this}}var t6=new S,e6=new S,A7=new M1,$6=new h8,o6=new b5,O9=new S,S7=new S;class NJ extends S1{constructor($=new n1,J=new Y6){super();this.isLine=!0,this.type="Line",this.geometry=$,this.material=J,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy($,J){return super.copy($,J),this.material=Array.isArray($.material)?$.material.slice():$.material,this.geometry=$.geometry,this}computeLineDistances(){let $=this.geometry;if($.index===null){let J=$.attributes.position,Q=[0];for(let M=1,H=J.count;M<H;M++)t6.fromBufferAttribute(J,M-1),e6.fromBufferAttribute(J,M),Q[M]=Q[M-1],Q[M]+=t6.distanceTo(e6);$.setAttribute("lineDistance",new l1(Q,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast($,J){let Q=this.geometry,M=this.matrixWorld,H=$.params.Line.threshold,K=Q.drawRange;if(Q.boundingSphere===null)Q.computeBoundingSphere();if(o6.copy(Q.boundingSphere),o6.applyMatrix4(M),o6.radius+=H,$.ray.intersectsSphere(o6)===!1)return;A7.copy(M).invert(),$6.copy($.ray).applyMatrix4(A7);let W=H/((this.scale.x+this.scale.y+this.scale.z)/3),k=W*W,E=this.isLineSegments?2:1,w=Q.index,Z=Q.attributes.position;if(w!==null){let U=Math.max(0,K.start),X=Math.min(w.count,K.start+K.count);for(let G=U,q=X-1;G<q;G+=E){let Y=w.getX(G),N=w.getX(G+1),B=i6(this,$,$6,k,Y,N,G);if(B)J.push(B)}if(this.isLineLoop){let G=w.getX(X-1),q=w.getX(U),Y=i6(this,$,$6,k,G,q,X-1);if(Y)J.push(Y)}}else{let U=Math.max(0,K.start),X=Math.min(Z.count,K.start+K.count);for(let G=U,q=X-1;G<q;G+=E){let Y=i6(this,$,$6,k,G,G+1,G);if(Y)J.push(Y)}if(this.isLineLoop){let G=i6(this,$,$6,k,X-1,U,X-1);if(G)J.push(G)}}}updateMorphTargets(){let J=this.geometry.morphAttributes,Q=Object.keys(J);if(Q.length>0){let M=J[Q[0]];if(M!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let H=0,K=M.length;H<K;H++){let W=M[H].name||String(H);this.morphTargetInfluences.push(0),this.morphTargetDictionary[W]=H}}}}}function i6($,J,Q,M,H,K,W){let k=$.geometry.attributes.position;if(t6.fromBufferAttribute(k,H),e6.fromBufferAttribute(k,K),Q.distanceSqToSegment(t6,e6,O9,S7)>M)return;O9.applyMatrix4($.matrixWorld);let w=J.ray.origin.distanceTo(O9);if(w<J.near||w>J.far)return;return{distance:w,point:S7.clone().applyMatrix4($.matrixWorld),index:W,face:null,faceIndex:null,barycoord:null,object:$}}var T7=new S,h7=new S;class z$ extends NJ{constructor($,J){super($,J);this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let $=this.geometry;if($.index===null){let J=$.attributes.position,Q=[];for(let M=0,H=J.count;M<H;M+=2)T7.fromBufferAttribute(J,M),h7.fromBufferAttribute(J,M+1),Q[M]=M===0?0:Q[M-1],Q[M+1]=Q[M]+T7.distanceTo(h7);$.setAttribute("lineDistance",new l1(Q,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class j8 extends A1{constructor($,J,Q=1014,M,H,K,W=1003,k=1003,E,w=1026,R=1){if(w!==1026&&w!==1027)throw Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let Z={width:$,height:J,depth:R};super(Z,M,H,K,W,k,w,Q,E);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy($){return super.copy($),this.source=new R6(Object.assign({},$.image)),this.compareFunction=$.compareFunction,this}toJSON($){let J=super.toJSON($);if(this.compareFunction!==null)J.compareFunction=this.compareFunction;return J}}class N6 extends n1{constructor($=1,J=1,Q=1,M=1){super();this.type="PlaneGeometry",this.parameters={width:$,height:J,widthSegments:Q,heightSegments:M};let H=$/2,K=J/2,W=Math.floor(Q),k=Math.floor(M),E=W+1,w=k+1,R=$/W,Z=J/k,U=[],X=[],G=[],q=[];for(let Y=0;Y<w;Y++){let N=Y*Z-K;for(let B=0;B<E;B++){let D=B*R-H;X.push(D,-N,0),G.push(0,0,1),q.push(B/W),q.push(1-Y/k)}}for(let Y=0;Y<k;Y++)for(let N=0;N<W;N++){let B=N+E*Y,D=N+E*(Y+1),V=N+1+E*(Y+1),h=N+1+E*Y;U.push(B,D,h),U.push(D,V,h)}this.setIndex(U),this.setAttribute("position",new l1(X,3)),this.setAttribute("normal",new l1(G,3)),this.setAttribute("uv",new l1(q,2))}copy($){return super.copy($),this.parameters=Object.assign({},$.parameters),this}static fromJSON($){return new N6($.width,$.height,$.widthSegments,$.heightSegments)}}class XJ extends e5{constructor($){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues($)}copy($){return super.copy($),this.depthPacking=$.depthPacking,this.map=$.map,this.alphaMap=$.alphaMap,this.displacementMap=$.displacementMap,this.displacementScale=$.displacementScale,this.displacementBias=$.displacementBias,this.wireframe=$.wireframe,this.wireframeLinewidth=$.wireframeLinewidth,this}}class GJ extends e5{constructor($){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues($)}copy($){return super.copy($),this.map=$.map,this.alphaMap=$.alphaMap,this.displacementMap=$.displacementMap,this.displacementScale=$.displacementScale,this.displacementBias=$.displacementBias,this}}function a6($,J){if(!$||$.constructor===J)return $;if(typeof J.BYTES_PER_ELEMENT==="number")return new J($);return Array.prototype.slice.call($)}function jH($){return ArrayBuffer.isView($)&&!($ instanceof DataView)}class y8{constructor($,J,Q,M){this.parameterPositions=$,this._cachedIndex=0,this.resultBuffer=M!==void 0?M:new J.constructor(Q),this.sampleValues=J,this.valueSize=Q,this.settings=null,this.DefaultSettings_={}}evaluate($){let J=this.parameterPositions,Q=this._cachedIndex,M=J[Q],H=J[Q-1];Q:{$:{let K;J:{M:if(!($<M)){for(let W=Q+2;;){if(M===void 0){if($<H)break M;return Q=J.length,this._cachedIndex=Q,this.copySampleValue_(Q-1)}if(Q===W)break;if(H=M,M=J[++Q],$<M)break $}K=J.length;break J}if(!($>=H)){let W=J[1];if($<W)Q=2,H=W;for(let k=Q-2;;){if(H===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(Q===k)break;if(M=H,H=J[--Q-1],$>=H)break $}K=Q,Q=0;break J}break Q}while(Q<K){let W=Q+K>>>1;if($<J[W])K=W;else Q=W+1}if(M=J[Q],H=J[Q-1],H===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(M===void 0)return Q=J.length,this._cachedIndex=Q,this.copySampleValue_(Q-1)}this._cachedIndex=Q,this.intervalChanged_(Q,H,M)}return this.interpolate_(Q,H,$,M)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_($){let J=this.resultBuffer,Q=this.sampleValues,M=this.valueSize,H=$*M;for(let K=0;K!==M;++K)J[K]=Q[H+K];return J}interpolate_(){throw Error("call to abstract method")}intervalChanged_(){}}class DJ extends y8{constructor($,J,Q,M){super($,J,Q,M);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_($,J,Q){let M=this.parameterPositions,H=$-2,K=$+1,W=M[H],k=M[K];if(W===void 0)switch(this.getSettings_().endingStart){case 2401:H=$,W=2*J-Q;break;case 2402:H=M.length-2,W=J+M[H]-M[H+1];break;default:H=$,W=Q}if(k===void 0)switch(this.getSettings_().endingEnd){case 2401:K=$,k=2*Q-J;break;case 2402:K=1,k=Q+M[1]-M[0];break;default:K=$-1,k=J}let E=(Q-J)*0.5,w=this.valueSize;this._weightPrev=E/(J-W),this._weightNext=E/(k-Q),this._offsetPrev=H*w,this._offsetNext=K*w}interpolate_($,J,Q,M){let H=this.resultBuffer,K=this.sampleValues,W=this.valueSize,k=$*W,E=k-W,w=this._offsetPrev,R=this._offsetNext,Z=this._weightPrev,U=this._weightNext,X=(Q-J)/(M-J),G=X*X,q=G*X,Y=-Z*q+2*Z*G-Z*X,N=(1+Z)*q+(-1.5-2*Z)*G+(-0.5+Z)*X+1,B=(-1-U)*q+(1.5+U)*G+0.5*X,D=U*q-U*G;for(let V=0;V!==W;++V)H[V]=Y*K[w+V]+N*K[E+V]+B*K[k+V]+D*K[R+V];return H}}class qJ extends y8{constructor($,J,Q,M){super($,J,Q,M)}interpolate_($,J,Q,M){let H=this.resultBuffer,K=this.sampleValues,W=this.valueSize,k=$*W,E=k-W,w=(Q-J)/(M-J),R=1-w;for(let Z=0;Z!==W;++Z)H[Z]=K[E+Z]*R+K[k+Z]*w;return H}}class OJ extends y8{constructor($,J,Q,M){super($,J,Q,M)}interpolate_($){return this.copySampleValue_($-1)}}class Q5{constructor($,J,Q,M){if($===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(J===void 0||J.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+$);this.name=$,this.times=a6(J,this.TimeBufferType),this.values=a6(Q,this.ValueBufferType),this.setInterpolation(M||this.DefaultInterpolation)}static toJSON($){let J=$.constructor,Q;if(J.toJSON!==this.toJSON)Q=J.toJSON($);else{Q={name:$.name,times:a6($.times,Array),values:a6($.values,Array)};let M=$.getInterpolation();if(M!==$.DefaultInterpolation)Q.interpolation=M}return Q.type=$.ValueTypeName,Q}InterpolantFactoryMethodDiscrete($){return new OJ(this.times,this.values,this.getValueSize(),$)}InterpolantFactoryMethodLinear($){return new qJ(this.times,this.values,this.getValueSize(),$)}InterpolantFactoryMethodSmooth($){return new DJ(this.times,this.values,this.getValueSize(),$)}setInterpolation($){let J;switch($){case 2300:J=this.InterpolantFactoryMethodDiscrete;break;case 2301:J=this.InterpolantFactoryMethodLinear;break;case 2302:J=this.InterpolantFactoryMethodSmooth;break}if(J===void 0){let Q="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if($!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(Q);return console.warn("THREE.KeyframeTrack:",Q),this}return this.createInterpolant=J,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302}}getValueSize(){return this.values.length/this.times.length}shift($){if($!==0){let J=this.times;for(let Q=0,M=J.length;Q!==M;++Q)J[Q]+=$}return this}scale($){if($!==1){let J=this.times;for(let Q=0,M=J.length;Q!==M;++Q)J[Q]*=$}return this}trim($,J){let Q=this.times,M=Q.length,H=0,K=M-1;while(H!==M&&Q[H]<$)++H;while(K!==-1&&Q[K]>J)--K;if(++K,H!==0||K!==M){if(H>=K)K=Math.max(K,1),H=K-1;let W=this.getValueSize();this.times=Q.slice(H,K),this.values=this.values.slice(H*W,K*W)}return this}validate(){let $=!0,J=this.getValueSize();if(J-Math.floor(J)!==0)console.error("THREE.KeyframeTrack: Invalid value size in track.",this),$=!1;let Q=this.times,M=this.values,H=Q.length;if(H===0)console.error("THREE.KeyframeTrack: Track is empty.",this),$=!1;let K=null;for(let W=0;W!==H;W++){let k=Q[W];if(typeof k==="number"&&isNaN(k)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,W,k),$=!1;break}if(K!==null&&K>k){console.error("THREE.KeyframeTrack: Out of order keys.",this,W,k,K),$=!1;break}K=k}if(M!==void 0){if(jH(M))for(let W=0,k=M.length;W!==k;++W){let E=M[W];if(isNaN(E)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,W,E),$=!1;break}}}return $}optimize(){let $=this.times.slice(),J=this.values.slice(),Q=this.getValueSize(),M=this.getInterpolation()===2302,H=$.length-1,K=1;for(let W=1;W<H;++W){let k=!1,E=$[W],w=$[W+1];if(E!==w&&(W!==1||E!==$[0]))if(!M){let R=W*Q,Z=R-Q,U=R+Q;for(let X=0;X!==Q;++X){let G=J[R+X];if(G!==J[Z+X]||G!==J[U+X]){k=!0;break}}}else k=!0;if(k){if(W!==K){$[K]=$[W];let R=W*Q,Z=K*Q;for(let U=0;U!==Q;++U)J[Z+U]=J[R+U]}++K}}if(H>0){$[K]=$[H];for(let W=H*Q,k=K*Q,E=0;E!==Q;++E)J[k+E]=J[W+E];++K}if(K!==$.length)this.times=$.slice(0,K),this.values=J.slice(0,K*Q);else this.times=$,this.values=J;return this}clone(){let $=this.times.slice(),J=this.values.slice(),M=new this.constructor(this.name,$,J);return M.createInterpolant=this.createInterpolant,M}}Q5.prototype.ValueTypeName="";Q5.prototype.TimeBufferType=Float32Array;Q5.prototype.ValueBufferType=Float32Array;Q5.prototype.DefaultInterpolation=2301;class J8 extends Q5{constructor($,J,Q){super($,J,Q)}}J8.prototype.ValueTypeName="bool";J8.prototype.ValueBufferType=Array;J8.prototype.DefaultInterpolation=2300;J8.prototype.InterpolantFactoryMethodLinear=void 0;J8.prototype.InterpolantFactoryMethodSmooth=void 0;class FJ extends Q5{constructor($,J,Q,M){super($,J,Q,M)}}FJ.prototype.ValueTypeName="color";class LJ extends Q5{constructor($,J,Q,M){super($,J,Q,M)}}LJ.prototype.ValueTypeName="number";class PJ extends y8{constructor($,J,Q,M){super($,J,Q,M)}interpolate_($,J,Q,M){let H=this.resultBuffer,K=this.sampleValues,W=this.valueSize,k=(Q-J)/(M-J),E=$*W;for(let w=E+W;E!==w;E+=4)m0.slerpFlat(H,0,K,E-W,K,E,k);return H}}class B$ extends Q5{constructor($,J,Q,M){super($,J,Q,M)}InterpolantFactoryMethodLinear($){return new PJ(this.times,this.values,this.getValueSize(),$)}}B$.prototype.ValueTypeName="quaternion";B$.prototype.InterpolantFactoryMethodSmooth=void 0;class Q8 extends Q5{constructor($,J,Q){super($,J,Q)}}Q8.prototype.ValueTypeName="string";Q8.prototype.ValueBufferType=Array;Q8.prototype.DefaultInterpolation=2300;Q8.prototype.InterpolantFactoryMethodLinear=void 0;Q8.prototype.InterpolantFactoryMethodSmooth=void 0;class VJ extends Q5{constructor($,J,Q,M){super($,J,Q,M)}}VJ.prototype.ValueTypeName="vector";class zJ{constructor($,J,Q){let M=this,H=!1,K=0,W=0,k=void 0,E=[];this.onStart=void 0,this.onLoad=$,this.onProgress=J,this.onError=Q,this.abortController=new AbortController,this.itemStart=function(w){if(W++,H===!1){if(M.onStart!==void 0)M.onStart(w,K,W)}H=!0},this.itemEnd=function(w){if(K++,M.onProgress!==void 0)M.onProgress(w,K,W);if(K===W){if(H=!1,M.onLoad!==void 0)M.onLoad()}},this.itemError=function(w){if(M.onError!==void 0)M.onError(w)},this.resolveURL=function(w){if(k)return k(w);return w},this.setURLModifier=function(w){return k=w,this},this.addHandler=function(w,R){return E.push(w,R),this},this.removeHandler=function(w){let R=E.indexOf(w);if(R!==-1)E.splice(R,2);return this},this.getHandler=function(w){for(let R=0,Z=E.length;R<Z;R+=2){let U=E[R],X=E[R+1];if(U.global)U.lastIndex=0;if(U.test(w))return X}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}var gQ=new zJ;class BJ{constructor($){this.manager=$!==void 0?$:gQ,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync($,J){let Q=this;return new Promise(function(M,H){Q.load($,M,J,H)})}parse(){}setCrossOrigin($){return this.crossOrigin=$,this}setWithCredentials($){return this.withCredentials=$,this}setPath($){return this.path=$,this}setResourcePath($){return this.resourcePath=$,this}setRequestHeader($){return this.requestHeader=$,this}abort(){return this}}BJ.DEFAULT_MATERIAL_NAME="__DEFAULT";class X6 extends F${constructor($=-1,J=1,Q=1,M=-1,H=0.1,K=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=$,this.right=J,this.top=Q,this.bottom=M,this.near=H,this.far=K,this.updateProjectionMatrix()}copy($,J){return super.copy($,J),this.left=$.left,this.right=$.right,this.top=$.top,this.bottom=$.bottom,this.near=$.near,this.far=$.far,this.zoom=$.zoom,this.view=$.view===null?null:Object.assign({},$.view),this}setViewOffset($,J,Q,M,H,K){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=$,this.view.fullHeight=J,this.view.offsetX=Q,this.view.offsetY=M,this.view.width=H,this.view.height=K,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let $=(this.right-this.left)/(2*this.zoom),J=(this.top-this.bottom)/(2*this.zoom),Q=(this.right+this.left)/2,M=(this.top+this.bottom)/2,H=Q-$,K=Q+$,W=M+J,k=M-J;if(this.view!==null&&this.view.enabled){let E=(this.right-this.left)/this.view.fullWidth/this.zoom,w=(this.top-this.bottom)/this.view.fullHeight/this.zoom;H+=E*this.view.offsetX,K=H+E*this.view.width,W-=w*this.view.offsetY,k=W-w*this.view.height}this.projectionMatrix.makeOrthographic(H,K,W,k,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON($){let J=super.toJSON($);if(J.object.zoom=this.zoom,J.object.left=this.left,J.object.right=this.right,J.object.top=this.top,J.object.bottom=this.bottom,J.object.near=this.near,J.object.far=this.far,this.view!==null)J.object.view=Object.assign({},this.view);return J}}class IJ extends F1{constructor($=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=$}}var CJ="\\[\\]\\.:\\/",yH=new RegExp("["+CJ+"]","g"),_J="[^"+CJ+"]",vH="[^"+CJ.replace("\\.","")+"]",bH=/((?:WC+[\/:])*)/.source.replace("WC",_J),pH=/(WCOD+)?/.source.replace("WCOD",vH),xH=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",_J),gH=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",_J),lH=new RegExp("^"+bH+pH+xH+gH+"$"),dH=["material","materials","bones","map"];class lQ{constructor($,J,Q){let M=Q||e0.parseTrackName(J);this._targetGroup=$,this._bindings=$.subscribe_(J,M)}getValue($,J){this.bind();let Q=this._targetGroup.nCachedObjects_,M=this._bindings[Q];if(M!==void 0)M.getValue($,J)}setValue($,J){let Q=this._bindings;for(let M=this._targetGroup.nCachedObjects_,H=Q.length;M!==H;++M)Q[M].setValue($,J)}bind(){let $=this._bindings;for(let J=this._targetGroup.nCachedObjects_,Q=$.length;J!==Q;++J)$[J].bind()}unbind(){let $=this._bindings;for(let J=this._targetGroup.nCachedObjects_,Q=$.length;J!==Q;++J)$[J].unbind()}}class e0{constructor($,J,Q){this.path=J,this.parsedPath=Q||e0.parseTrackName(J),this.node=e0.findNode($,this.parsedPath.nodeName),this.rootNode=$,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create($,J,Q){if(!($&&$.isAnimationObjectGroup))return new e0($,J,Q);else return new e0.Composite($,J,Q)}static sanitizeNodeName($){return $.replace(/\s/g,"_").replace(yH,"")}static parseTrackName($){let J=lH.exec($);if(J===null)throw Error("PropertyBinding: Cannot parse trackName: "+$);let Q={nodeName:J[2],objectName:J[3],objectIndex:J[4],propertyName:J[5],propertyIndex:J[6]},M=Q.nodeName&&Q.nodeName.lastIndexOf(".");if(M!==void 0&&M!==-1){let H=Q.nodeName.substring(M+1);if(dH.indexOf(H)!==-1)Q.nodeName=Q.nodeName.substring(0,M),Q.objectName=H}if(Q.propertyName===null||Q.propertyName.length===0)throw Error("PropertyBinding: can not parse propertyName from trackName: "+$);return Q}static findNode($,J){if(J===void 0||J===""||J==="."||J===-1||J===$.name||J===$.uuid)return $;if($.skeleton){let Q=$.skeleton.getBoneByName(J);if(Q!==void 0)return Q}if($.children){let Q=function(H){for(let K=0;K<H.length;K++){let W=H[K];if(W.name===J||W.uuid===J)return W;let k=Q(W.children);if(k)return k}return null},M=Q($.children);if(M)return M}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct($,J){$[J]=this.targetObject[this.propertyName]}_getValue_array($,J){let Q=this.resolvedProperty;for(let M=0,H=Q.length;M!==H;++M)$[J++]=Q[M]}_getValue_arrayElement($,J){$[J]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray($,J){this.resolvedProperty.toArray($,J)}_setValue_direct($,J){this.targetObject[this.propertyName]=$[J]}_setValue_direct_setNeedsUpdate($,J){this.targetObject[this.propertyName]=$[J],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate($,J){this.targetObject[this.propertyName]=$[J],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array($,J){let Q=this.resolvedProperty;for(let M=0,H=Q.length;M!==H;++M)Q[M]=$[J++]}_setValue_array_setNeedsUpdate($,J){let Q=this.resolvedProperty;for(let M=0,H=Q.length;M!==H;++M)Q[M]=$[J++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate($,J){let Q=this.resolvedProperty;for(let M=0,H=Q.length;M!==H;++M)Q[M]=$[J++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement($,J){this.resolvedProperty[this.propertyIndex]=$[J]}_setValue_arrayElement_setNeedsUpdate($,J){this.resolvedProperty[this.propertyIndex]=$[J],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate($,J){this.resolvedProperty[this.propertyIndex]=$[J],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray($,J){this.resolvedProperty.fromArray($,J)}_setValue_fromArray_setNeedsUpdate($,J){this.resolvedProperty.fromArray($,J),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate($,J){this.resolvedProperty.fromArray($,J),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound($,J){this.bind(),this.getValue($,J)}_setValue_unbound($,J){this.bind(),this.setValue($,J)}bind(){let $=this.node,J=this.parsedPath,Q=J.objectName,M=J.propertyName,H=J.propertyIndex;if(!$)$=e0.findNode(this.rootNode,J.nodeName),this.node=$;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!$){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(Q){let E=J.objectIndex;switch(Q){case"materials":if(!$.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!$.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}$=$.material.materials;break;case"bones":if(!$.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}$=$.skeleton.bones;for(let w=0;w<$.length;w++)if($[w].name===E){E=w;break}break;case"map":if("map"in $){$=$.map;break}if(!$.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!$.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}$=$.material.map;break;default:if($[Q]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}$=$[Q]}if(E!==void 0){if($[E]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,$);return}$=$[E]}}let K=$[M];if(K===void 0){let E=J.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+E+"."+M+" but it wasn't found.",$);return}let W=this.Versioning.None;if(this.targetObject=$,$.isMaterial===!0)W=this.Versioning.NeedsUpdate;else if($.isObject3D===!0)W=this.Versioning.MatrixWorldNeedsUpdate;let k=this.BindingType.Direct;if(H!==void 0){if(M==="morphTargetInfluences"){if(!$.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!$.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if($.morphTargetDictionary[H]!==void 0)H=$.morphTargetDictionary[H]}k=this.BindingType.ArrayElement,this.resolvedProperty=K,this.propertyIndex=H}else if(K.fromArray!==void 0&&K.toArray!==void 0)k=this.BindingType.HasFromToArray,this.resolvedProperty=K;else if(Array.isArray(K))k=this.BindingType.EntireArray,this.resolvedProperty=K;else this.propertyName=M;this.getValue=this.GetterByBindingType[k],this.setValue=this.SetterByBindingTypeAndVersioning[k][W]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}e0.Composite=lQ;e0.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};e0.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};e0.prototype.GetterByBindingType=[e0.prototype._getValue_direct,e0.prototype._getValue_array,e0.prototype._getValue_arrayElement,e0.prototype._getValue_toArray];e0.prototype.SetterByBindingTypeAndVersioning=[[e0.prototype._setValue_direct,e0.prototype._setValue_direct_setNeedsUpdate,e0.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[e0.prototype._setValue_array,e0.prototype._setValue_array_setNeedsUpdate,e0.prototype._setValue_array_setMatrixWorldNeedsUpdate],[e0.prototype._setValue_arrayElement,e0.prototype._setValue_arrayElement_setNeedsUpdate,e0.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[e0.prototype._setValue_fromArray,e0.prototype._setValue_fromArray_setNeedsUpdate,e0.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var rw=new Float32Array(1);function AJ($,J,Q,M){let H=mH(M);switch(Q){case 1021:return $*J;case 1028:return $*J/H.components*H.byteLength;case 1029:return $*J/H.components*H.byteLength;case 1030:return $*J*2/H.components*H.byteLength;case 1031:return $*J*2/H.components*H.byteLength;case 1022:return $*J*3/H.components*H.byteLength;case 1023:return $*J*4/H.components*H.byteLength;case 1033:return $*J*4/H.components*H.byteLength;case 33776:case 33777:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*8;case 33778:case 33779:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*16;case 35841:case 35843:return Math.max($,16)*Math.max(J,8)/4;case 35840:case 35842:return Math.max($,8)*Math.max(J,8)/2;case 36196:case 37492:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*8;case 37496:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*16;case 37808:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*16;case 37809:return Math.floor(($+4)/5)*Math.floor((J+3)/4)*16;case 37810:return Math.floor(($+4)/5)*Math.floor((J+4)/5)*16;case 37811:return Math.floor(($+5)/6)*Math.floor((J+4)/5)*16;case 37812:return Math.floor(($+5)/6)*Math.floor((J+5)/6)*16;case 37813:return Math.floor(($+7)/8)*Math.floor((J+4)/5)*16;case 37814:return Math.floor(($+7)/8)*Math.floor((J+5)/6)*16;case 37815:return Math.floor(($+7)/8)*Math.floor((J+7)/8)*16;case 37816:return Math.floor(($+9)/10)*Math.floor((J+4)/5)*16;case 37817:return Math.floor(($+9)/10)*Math.floor((J+5)/6)*16;case 37818:return Math.floor(($+9)/10)*Math.floor((J+7)/8)*16;case 37819:return Math.floor(($+9)/10)*Math.floor((J+9)/10)*16;case 37820:return Math.floor(($+11)/12)*Math.floor((J+9)/10)*16;case 37821:return Math.floor(($+11)/12)*Math.floor((J+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil($/4)*Math.ceil(J/4)*16;case 36283:case 36284:return Math.ceil($/4)*Math.ceil(J/4)*8;case 36285:case 36286:return Math.ceil($/4)*Math.ceil(J/4)*16}throw Error(`Unable to determine texture byte length for ${Q} format.`)}function mH($){switch($){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:return{byteLength:4,components:3}}throw Error(`Unknown texture type ${$}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"179"}}));if(typeof window<"u")if(window.__THREE__)console.warn("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="179";function RM(){let $=null,J=!1,Q=null,M=null;function H(K,W){Q(K,W),M=$.requestAnimationFrame(H)}return{start:function(){if(J===!0)return;if(Q===null)return;M=$.requestAnimationFrame(H),J=!0},stop:function(){$.cancelAnimationFrame(M),J=!1},setAnimationLoop:function(K){Q=K},setContext:function(K){$=K}}}function uH($){let J=new WeakMap;function Q(k,E){let{array:w,usage:R}=k,Z=w.byteLength,U=$.createBuffer();$.bindBuffer(E,U),$.bufferData(E,w,R),k.onUploadCallback();let X;if(w instanceof Float32Array)X=$.FLOAT;else if(typeof Float16Array<"u"&&w instanceof Float16Array)X=$.HALF_FLOAT;else if(w instanceof Uint16Array)if(k.isFloat16BufferAttribute)X=$.HALF_FLOAT;else X=$.UNSIGNED_SHORT;else if(w instanceof Int16Array)X=$.SHORT;else if(w instanceof Uint32Array)X=$.UNSIGNED_INT;else if(w instanceof Int32Array)X=$.INT;else if(w instanceof Int8Array)X=$.BYTE;else if(w instanceof Uint8Array)X=$.UNSIGNED_BYTE;else if(w instanceof Uint8ClampedArray)X=$.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+w);return{buffer:U,type:X,bytesPerElement:w.BYTES_PER_ELEMENT,version:k.version,size:Z}}function M(k,E,w){let{array:R,updateRanges:Z}=E;if($.bindBuffer(w,k),Z.length===0)$.bufferSubData(w,0,R);else{Z.sort((X,G)=>X.start-G.start);let U=0;for(let X=1;X<Z.length;X++){let G=Z[U],q=Z[X];if(q.start<=G.start+G.count+1)G.count=Math.max(G.count,q.start+q.count-G.start);else++U,Z[U]=q}Z.length=U+1;for(let X=0,G=Z.length;X<G;X++){let q=Z[X];$.bufferSubData(w,q.start*R.BYTES_PER_ELEMENT,R,q.start,q.count)}E.clearUpdateRanges()}E.onUploadCallback()}function H(k){if(k.isInterleavedBufferAttribute)k=k.data;return J.get(k)}function K(k){if(k.isInterleavedBufferAttribute)k=k.data;let E=J.get(k);if(E)$.deleteBuffer(E.buffer),J.delete(k)}function W(k,E){if(k.isInterleavedBufferAttribute)k=k.data;if(k.isGLBufferAttribute){let R=J.get(k);if(!R||R.version<k.version)J.set(k,{buffer:k.buffer,type:k.type,bytesPerElement:k.elementSize,version:k.version});return}let w=J.get(k);if(w===void 0)J.set(k,Q(k,E));else if(w.version<k.version){if(w.size!==k.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");M(w.buffer,k,E),w.version=k.version}}return{get:H,remove:K,update:W}}var cH=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,nH=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,sH=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,oH=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,iH=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,aH=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,rH=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,tH=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,eH=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,$K=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,JK=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,QK=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,MK=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,HK=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,KK=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,WK=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,kK=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,EK=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,wK=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,ZK=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,RK=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,UK=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,YK=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,NK=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,XK=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,GK=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,DK=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,qK=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,OK=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,FK=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,LK="gl_FragColor = linearToOutputTexel( gl_FragColor );",PK=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,VK=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,zK=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,BK=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,IK=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,CK=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,_K=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,AK=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,SK=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,TK=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,hK=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,fK=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,jK=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,yK=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,vK=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,bK=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,pK=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,xK=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,gK=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lK=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,dK=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,mK=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,uK=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,cK=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,nK=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,sK=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,oK=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,iK=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,aK=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,rK=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,tK=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,eK=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,$W=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,JW=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,QW=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,MW=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,HW=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,KW=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,WW=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,kW=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,EW=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,wW=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,ZW=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,RW=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,UW=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,YW=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,NW=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,XW=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,GW=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,DW=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,qW=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,OW=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,FW=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,LW=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,PW=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,VW=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,zW=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,BW=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,IW=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSEDEPTHBUF
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSEDEPTHBUF
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare , distribution.x );
		#endif
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,CW=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,_W=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,AW=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,SW=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,TW=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,hW=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,fW=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,jW=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,yW=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,vW=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,bW=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,pW=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,xW=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,gW=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,lW=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,dW=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,mW=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,uW=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,cW=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,nW=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,sW=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,oW=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,iW=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,aW=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,rW=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSEDEPTHBUF
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,tW=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,eW=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,$k=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Jk=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qk=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Mk=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Hk=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Kk=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Wk=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,kk=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ek=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,wk=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Zk=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Rk=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Uk=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Yk=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Nk=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Xk=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Gk=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Dk=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qk=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Ok=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Fk=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Lk=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Pk=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Vk=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,g0={alphahash_fragment:cH,alphahash_pars_fragment:nH,alphamap_fragment:sH,alphamap_pars_fragment:oH,alphatest_fragment:iH,alphatest_pars_fragment:aH,aomap_fragment:rH,aomap_pars_fragment:tH,batching_pars_vertex:eH,batching_vertex:$K,begin_vertex:JK,beginnormal_vertex:QK,bsdfs:MK,iridescence_fragment:HK,bumpmap_pars_fragment:KK,clipping_planes_fragment:WK,clipping_planes_pars_fragment:kK,clipping_planes_pars_vertex:EK,clipping_planes_vertex:wK,color_fragment:ZK,color_pars_fragment:RK,color_pars_vertex:UK,color_vertex:YK,common:NK,cube_uv_reflection_fragment:XK,defaultnormal_vertex:GK,displacementmap_pars_vertex:DK,displacementmap_vertex:qK,emissivemap_fragment:OK,emissivemap_pars_fragment:FK,colorspace_fragment:LK,colorspace_pars_fragment:PK,envmap_fragment:VK,envmap_common_pars_fragment:zK,envmap_pars_fragment:BK,envmap_pars_vertex:IK,envmap_physical_pars_fragment:bK,envmap_vertex:CK,fog_vertex:_K,fog_pars_vertex:AK,fog_fragment:SK,fog_pars_fragment:TK,gradientmap_pars_fragment:hK,lightmap_pars_fragment:fK,lights_lambert_fragment:jK,lights_lambert_pars_fragment:yK,lights_pars_begin:vK,lights_toon_fragment:pK,lights_toon_pars_fragment:xK,lights_phong_fragment:gK,lights_phong_pars_fragment:lK,lights_physical_fragment:dK,lights_physical_pars_fragment:mK,lights_fragment_begin:uK,lights_fragment_maps:cK,lights_fragment_end:nK,logdepthbuf_fragment:sK,logdepthbuf_pars_fragment:oK,logdepthbuf_pars_vertex:iK,logdepthbuf_vertex:aK,map_fragment:rK,map_pars_fragment:tK,map_particle_fragment:eK,map_particle_pars_fragment:$W,metalnessmap_fragment:JW,metalnessmap_pars_fragment:QW,morphinstance_vertex:MW,morphcolor_vertex:HW,morphnormal_vertex:KW,morphtarget_pars_vertex:WW,morphtarget_vertex:kW,normal_fragment_begin:EW,normal_fragment_maps:wW,normal_pars_fragment:ZW,normal_pars_vertex:RW,normal_vertex:UW,normalmap_pars_fragment:YW,clearcoat_normal_fragment_begin:NW,clearcoat_normal_fragment_maps:XW,clearcoat_pars_fragment:GW,iridescence_pars_fragment:DW,opaque_fragment:qW,packing:OW,premultiplied_alpha_fragment:FW,project_vertex:LW,dithering_fragment:PW,dithering_pars_fragment:VW,roughnessmap_fragment:zW,roughnessmap_pars_fragment:BW,shadowmap_pars_fragment:IW,shadowmap_pars_vertex:CW,shadowmap_vertex:_W,shadowmask_pars_fragment:AW,skinbase_vertex:SW,skinning_pars_vertex:TW,skinning_vertex:hW,skinnormal_vertex:fW,specularmap_fragment:jW,specularmap_pars_fragment:yW,tonemapping_fragment:vW,tonemapping_pars_fragment:bW,transmission_fragment:pW,transmission_pars_fragment:xW,uv_pars_fragment:gW,uv_pars_vertex:lW,uv_vertex:dW,worldpos_vertex:mW,background_vert:uW,background_frag:cW,backgroundCube_vert:nW,backgroundCube_frag:sW,cube_vert:oW,cube_frag:iW,depth_vert:aW,depth_frag:rW,distanceRGBA_vert:tW,distanceRGBA_frag:eW,equirect_vert:$k,equirect_frag:Jk,linedashed_vert:Qk,linedashed_frag:Mk,meshbasic_vert:Hk,meshbasic_frag:Kk,meshlambert_vert:Wk,meshlambert_frag:kk,meshmatcap_vert:Ek,meshmatcap_frag:wk,meshnormal_vert:Zk,meshnormal_frag:Rk,meshphong_vert:Uk,meshphong_frag:Yk,meshphysical_vert:Nk,meshphysical_frag:Xk,meshtoon_vert:Gk,meshtoon_frag:Dk,points_vert:qk,points_frag:Ok,shadow_vert:Fk,shadow_frag:Lk,sprite_vert:Pk,sprite_frag:Vk},Y0={common:{diffuse:{value:new r0(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new x0},alphaMap:{value:null},alphaMapTransform:{value:new x0},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new x0}},envmap:{envMap:{value:null},envMapRotation:{value:new x0},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new x0}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new x0}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new x0},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new x0},normalScale:{value:new $1(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new x0},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new x0}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new x0}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new x0}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new r0(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new r0(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new x0},alphaTest:{value:0},uvTransform:{value:new x0}},sprite:{diffuse:{value:new r0(16777215)},opacity:{value:1},center:{value:new $1(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new x0},alphaMap:{value:null},alphaMapTransform:{value:new x0},alphaTest:{value:0}}},Y5={basic:{uniforms:C1([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.fog]),vertexShader:g0.meshbasic_vert,fragmentShader:g0.meshbasic_frag},lambert:{uniforms:C1([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,Y0.lights,{emissive:{value:new r0(0)}}]),vertexShader:g0.meshlambert_vert,fragmentShader:g0.meshlambert_frag},phong:{uniforms:C1([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,Y0.lights,{emissive:{value:new r0(0)},specular:{value:new r0(1118481)},shininess:{value:30}}]),vertexShader:g0.meshphong_vert,fragmentShader:g0.meshphong_frag},standard:{uniforms:C1([Y0.common,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.roughnessmap,Y0.metalnessmap,Y0.fog,Y0.lights,{emissive:{value:new r0(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:g0.meshphysical_vert,fragmentShader:g0.meshphysical_frag},toon:{uniforms:C1([Y0.common,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.gradientmap,Y0.fog,Y0.lights,{emissive:{value:new r0(0)}}]),vertexShader:g0.meshtoon_vert,fragmentShader:g0.meshtoon_frag},matcap:{uniforms:C1([Y0.common,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,{matcap:{value:null}}]),vertexShader:g0.meshmatcap_vert,fragmentShader:g0.meshmatcap_frag},points:{uniforms:C1([Y0.points,Y0.fog]),vertexShader:g0.points_vert,fragmentShader:g0.points_frag},dashed:{uniforms:C1([Y0.common,Y0.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:g0.linedashed_vert,fragmentShader:g0.linedashed_frag},depth:{uniforms:C1([Y0.common,Y0.displacementmap]),vertexShader:g0.depth_vert,fragmentShader:g0.depth_frag},normal:{uniforms:C1([Y0.common,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,{opacity:{value:1}}]),vertexShader:g0.meshnormal_vert,fragmentShader:g0.meshnormal_frag},sprite:{uniforms:C1([Y0.sprite,Y0.fog]),vertexShader:g0.sprite_vert,fragmentShader:g0.sprite_frag},background:{uniforms:{uvTransform:{value:new x0},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:g0.background_vert,fragmentShader:g0.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new x0}},vertexShader:g0.backgroundCube_vert,fragmentShader:g0.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:g0.cube_vert,fragmentShader:g0.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:g0.equirect_vert,fragmentShader:g0.equirect_frag},distanceRGBA:{uniforms:C1([Y0.common,Y0.displacementmap,{referencePosition:{value:new S},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:g0.distanceRGBA_vert,fragmentShader:g0.distanceRGBA_frag},shadow:{uniforms:C1([Y0.lights,Y0.fog,{color:{value:new r0(0)},opacity:{value:1}}]),vertexShader:g0.shadow_vert,fragmentShader:g0.shadow_frag}};Y5.physical={uniforms:C1([Y5.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new x0},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new x0},clearcoatNormalScale:{value:new $1(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new x0},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new x0},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new x0},sheen:{value:0},sheenColor:{value:new r0(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new x0},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new x0},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new x0},transmissionSamplerSize:{value:new $1},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new x0},attenuationDistance:{value:0},attenuationColor:{value:new r0(0)},specularColor:{value:new r0(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new x0},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new x0},anisotropyVector:{value:new $1},anisotropyMap:{value:null},anisotropyMapTransform:{value:new x0}}]),vertexShader:g0.meshphysical_vert,fragmentShader:g0.meshphysical_frag};var I$={r:0,b:0,g:0},M8=new d1,zk=new M1;function Bk($,J,Q,M,H,K,W){let k=new r0(0),E=K===!0?0:1,w,R,Z=null,U=0,X=null;function G(D){let V=D.isScene===!0?D.background:null;if(V&&V.isTexture)V=(D.backgroundBlurriness>0?Q:J).get(V);return V}function q(D){let V=!1,h=G(D);if(h===null)N(k,E);else if(h&&h.isColor)N(h,1),V=!0;let C=$.xr.getEnvironmentBlendMode();if(C==="additive")M.buffers.color.setClear(0,0,0,1,W);else if(C==="alpha-blend")M.buffers.color.setClear(0,0,0,0,W);if($.autoClear||V)M.buffers.depth.setTest(!0),M.buffers.depth.setMask(!0),M.buffers.color.setMask(!0),$.clear($.autoClearColor,$.autoClearDepth,$.autoClearStencil)}function Y(D,V){let h=G(V);if(h&&(h.isCubeTexture||h.mapping===H6)){if(R===void 0)R=new f1(new f8(1,1,1),new J5({name:"BackgroundCubeMaterial",uniforms:$8(Y5.backgroundCube.uniforms),vertexShader:Y5.backgroundCube.vertexShader,fragmentShader:Y5.backgroundCube.fragmentShader,side:m1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),R.geometry.deleteAttribute("normal"),R.geometry.deleteAttribute("uv"),R.onBeforeRender=function(C,z,y){this.matrixWorld.copyPosition(y.matrixWorld)},Object.defineProperty(R.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),H.update(R);if(M8.copy(V.backgroundRotation),M8.x*=-1,M8.y*=-1,M8.z*=-1,h.isCubeTexture&&h.isRenderTargetTexture===!1)M8.y*=-1,M8.z*=-1;if(R.material.uniforms.envMap.value=h,R.material.uniforms.flipEnvMap.value=h.isCubeTexture&&h.isRenderTargetTexture===!1?-1:1,R.material.uniforms.backgroundBlurriness.value=V.backgroundBlurriness,R.material.uniforms.backgroundIntensity.value=V.backgroundIntensity,R.material.uniforms.backgroundRotation.value.setFromMatrix4(zk.makeRotationFromEuler(M8)),R.material.toneMapped=i0.getTransfer(h.colorSpace)!==K1,Z!==h||U!==h.version||X!==$.toneMapping)R.material.needsUpdate=!0,Z=h,U=h.version,X=$.toneMapping;R.layers.enableAll(),D.unshift(R,R.geometry,R.material,0,0,null)}else if(h&&h.isTexture){if(w===void 0)w=new f1(new N6(2,2),new J5({name:"BackgroundMaterial",uniforms:$8(Y5.background.uniforms),vertexShader:Y5.background.vertexShader,fragmentShader:Y5.background.fragmentShader,side:R5,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),w.geometry.deleteAttribute("normal"),Object.defineProperty(w.material,"map",{get:function(){return this.uniforms.t2D.value}}),H.update(w);if(w.material.uniforms.t2D.value=h,w.material.uniforms.backgroundIntensity.value=V.backgroundIntensity,w.material.toneMapped=i0.getTransfer(h.colorSpace)!==K1,h.matrixAutoUpdate===!0)h.updateMatrix();if(w.material.uniforms.uvTransform.value.copy(h.matrix),Z!==h||U!==h.version||X!==$.toneMapping)w.material.needsUpdate=!0,Z=h,U=h.version,X=$.toneMapping;w.layers.enableAll(),D.unshift(w,w.geometry,w.material,0,0,null)}}function N(D,V){D.getRGB(I$,RJ($)),M.buffers.color.setClear(I$.r,I$.g,I$.b,V,W)}function B(){if(R!==void 0)R.geometry.dispose(),R.material.dispose(),R=void 0;if(w!==void 0)w.geometry.dispose(),w.material.dispose(),w=void 0}return{getClearColor:function(){return k},setClearColor:function(D,V=1){k.set(D),E=V,N(k,E)},getClearAlpha:function(){return E},setClearAlpha:function(D){E=D,N(k,E)},render:q,addToRenderList:Y,dispose:B}}function Ik($,J){let Q=$.getParameter($.MAX_VERTEX_ATTRIBS),M={},H=U(null),K=H,W=!1;function k(F,f,u,x,c){let t=!1,d=Z(x,u,f);if(K!==d)K=d,w(K.object);if(t=X(F,x,u,c),t)G(F,x,u,c);if(c!==null)J.update(c,$.ELEMENT_ARRAY_BUFFER);if(t||W){if(W=!1,V(F,f,u,x),c!==null)$.bindBuffer($.ELEMENT_ARRAY_BUFFER,J.get(c).buffer)}}function E(){return $.createVertexArray()}function w(F){return $.bindVertexArray(F)}function R(F){return $.deleteVertexArray(F)}function Z(F,f,u){let x=u.wireframe===!0,c=M[F.id];if(c===void 0)c={},M[F.id]=c;let t=c[f.id];if(t===void 0)t={},c[f.id]=t;let d=t[x];if(d===void 0)d=U(E()),t[x]=d;return d}function U(F){let f=[],u=[],x=[];for(let c=0;c<Q;c++)f[c]=0,u[c]=0,x[c]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:f,enabledAttributes:u,attributeDivisors:x,object:F,attributes:{},index:null}}function X(F,f,u,x){let c=K.attributes,t=f.attributes,d=0,e=u.getAttributes();for(let g in e)if(e[g].location>=0){let w0=c[g],z0=t[g];if(z0===void 0){if(g==="instanceMatrix"&&F.instanceMatrix)z0=F.instanceMatrix;if(g==="instanceColor"&&F.instanceColor)z0=F.instanceColor}if(w0===void 0)return!0;if(w0.attribute!==z0)return!0;if(z0&&w0.data!==z0.data)return!0;d++}if(K.attributesNum!==d)return!0;if(K.index!==x)return!0;return!1}function G(F,f,u,x){let c={},t=f.attributes,d=0,e=u.getAttributes();for(let g in e)if(e[g].location>=0){let w0=t[g];if(w0===void 0){if(g==="instanceMatrix"&&F.instanceMatrix)w0=F.instanceMatrix;if(g==="instanceColor"&&F.instanceColor)w0=F.instanceColor}let z0={};if(z0.attribute=w0,w0&&w0.data)z0.data=w0.data;c[g]=z0,d++}K.attributes=c,K.attributesNum=d,K.index=x}function q(){let F=K.newAttributes;for(let f=0,u=F.length;f<u;f++)F[f]=0}function Y(F){N(F,0)}function N(F,f){let{newAttributes:u,enabledAttributes:x,attributeDivisors:c}=K;if(u[F]=1,x[F]===0)$.enableVertexAttribArray(F),x[F]=1;if(c[F]!==f)$.vertexAttribDivisor(F,f),c[F]=f}function B(){let{newAttributes:F,enabledAttributes:f}=K;for(let u=0,x=f.length;u<x;u++)if(f[u]!==F[u])$.disableVertexAttribArray(u),f[u]=0}function D(F,f,u,x,c,t,d){if(d===!0)$.vertexAttribIPointer(F,f,u,c,t);else $.vertexAttribPointer(F,f,u,x,c,t)}function V(F,f,u,x){q();let c=x.attributes,t=u.getAttributes(),d=f.defaultAttributeValues;for(let e in t){let g=t[e];if(g.location>=0){let W0=c[e];if(W0===void 0){if(e==="instanceMatrix"&&F.instanceMatrix)W0=F.instanceMatrix;if(e==="instanceColor"&&F.instanceColor)W0=F.instanceColor}if(W0!==void 0){let{normalized:w0,itemSize:z0}=W0,b0=J.get(W0);if(b0===void 0)continue;let{buffer:c0,type:p,bytesPerElement:M0}=b0,U0=p===$.INT||p===$.UNSIGNED_INT||W0.gpuType===B9;if(W0.isInterleavedBufferAttribute){let Z0=W0.data,X0=Z0.stride,y0=W0.offset;if(Z0.isInstancedInterleavedBuffer){for(let T0=0;T0<g.locationSize;T0++)N(g.location+T0,Z0.meshPerAttribute);if(F.isInstancedMesh!==!0&&x._maxInstanceCount===void 0)x._maxInstanceCount=Z0.meshPerAttribute*Z0.count}else for(let T0=0;T0<g.locationSize;T0++)Y(g.location+T0);$.bindBuffer($.ARRAY_BUFFER,c0);for(let T0=0;T0<g.locationSize;T0++)D(g.location+T0,z0/g.locationSize,p,w0,X0*M0,(y0+z0/g.locationSize*T0)*M0,U0)}else{if(W0.isInstancedBufferAttribute){for(let Z0=0;Z0<g.locationSize;Z0++)N(g.location+Z0,W0.meshPerAttribute);if(F.isInstancedMesh!==!0&&x._maxInstanceCount===void 0)x._maxInstanceCount=W0.meshPerAttribute*W0.count}else for(let Z0=0;Z0<g.locationSize;Z0++)Y(g.location+Z0);$.bindBuffer($.ARRAY_BUFFER,c0);for(let Z0=0;Z0<g.locationSize;Z0++)D(g.location+Z0,z0/g.locationSize,p,w0,z0*M0,z0/g.locationSize*Z0*M0,U0)}}else if(d!==void 0){let w0=d[e];if(w0!==void 0)switch(w0.length){case 2:$.vertexAttrib2fv(g.location,w0);break;case 3:$.vertexAttrib3fv(g.location,w0);break;case 4:$.vertexAttrib4fv(g.location,w0);break;default:$.vertexAttrib1fv(g.location,w0)}}}}B()}function h(){y();for(let F in M){let f=M[F];for(let u in f){let x=f[u];for(let c in x)R(x[c].object),delete x[c];delete f[u]}delete M[F]}}function C(F){if(M[F.id]===void 0)return;let f=M[F.id];for(let u in f){let x=f[u];for(let c in x)R(x[c].object),delete x[c];delete f[u]}delete M[F.id]}function z(F){for(let f in M){let u=M[f];if(u[F.id]===void 0)continue;let x=u[F.id];for(let c in x)R(x[c].object),delete x[c];delete u[F.id]}}function y(){if(P(),W=!0,K===H)return;K=H,w(K.object)}function P(){H.geometry=null,H.program=null,H.wireframe=!1}return{setup:k,reset:y,resetDefaultState:P,dispose:h,releaseStatesOfGeometry:C,releaseStatesOfProgram:z,initAttributes:q,enableAttribute:Y,disableUnusedAttributes:B}}function Ck($,J,Q){let M;function H(w){M=w}function K(w,R){$.drawArrays(M,w,R),Q.update(R,M,1)}function W(w,R,Z){if(Z===0)return;$.drawArraysInstanced(M,w,R,Z),Q.update(R,M,Z)}function k(w,R,Z){if(Z===0)return;J.get("WEBGL_multi_draw").multiDrawArraysWEBGL(M,w,0,R,0,Z);let X=0;for(let G=0;G<Z;G++)X+=R[G];Q.update(X,M,1)}function E(w,R,Z,U){if(Z===0)return;let X=J.get("WEBGL_multi_draw");if(X===null)for(let G=0;G<w.length;G++)W(w[G],R[G],U[G]);else{X.multiDrawArraysInstancedWEBGL(M,w,0,R,0,U,0,Z);let G=0;for(let q=0;q<Z;q++)G+=R[q]*U[q];Q.update(G,M,1)}}this.setMode=H,this.render=K,this.renderInstances=W,this.renderMultiDraw=k,this.renderMultiDrawInstances=E}function _k($,J,Q,M){let H;function K(){if(H!==void 0)return H;if(J.has("EXT_texture_filter_anisotropic")===!0){let z=J.get("EXT_texture_filter_anisotropic");H=$.getParameter(z.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else H=0;return H}function W(z){if(z!==e1&&M.convert(z)!==$.getParameter($.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function k(z){let y=z===k6&&(J.has("EXT_color_buffer_half_float")||J.has("EXT_color_buffer_float"));if(z!==U5&&M.convert(z)!==$.getParameter($.IMPLEMENTATION_COLOR_READ_TYPE)&&z!==y5&&!y)return!1;return!0}function E(z){if(z==="highp"){if($.getShaderPrecisionFormat($.VERTEX_SHADER,$.HIGH_FLOAT).precision>0&&$.getShaderPrecisionFormat($.FRAGMENT_SHADER,$.HIGH_FLOAT).precision>0)return"highp";z="mediump"}if(z==="mediump"){if($.getShaderPrecisionFormat($.VERTEX_SHADER,$.MEDIUM_FLOAT).precision>0&&$.getShaderPrecisionFormat($.FRAGMENT_SHADER,$.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let w=Q.precision!==void 0?Q.precision:"highp",R=E(w);if(R!==w)console.warn("THREE.WebGLRenderer:",w,"not supported, using",R,"instead."),w=R;let Z=Q.logarithmicDepthBuffer===!0,U=Q.reversedDepthBuffer===!0&&J.has("EXT_clip_control"),X=$.getParameter($.MAX_TEXTURE_IMAGE_UNITS),G=$.getParameter($.MAX_VERTEX_TEXTURE_IMAGE_UNITS),q=$.getParameter($.MAX_TEXTURE_SIZE),Y=$.getParameter($.MAX_CUBE_MAP_TEXTURE_SIZE),N=$.getParameter($.MAX_VERTEX_ATTRIBS),B=$.getParameter($.MAX_VERTEX_UNIFORM_VECTORS),D=$.getParameter($.MAX_VARYING_VECTORS),V=$.getParameter($.MAX_FRAGMENT_UNIFORM_VECTORS),h=G>0,C=$.getParameter($.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:K,getMaxPrecision:E,textureFormatReadable:W,textureTypeReadable:k,precision:w,logarithmicDepthBuffer:Z,reversedDepthBuffer:U,maxTextures:X,maxVertexTextures:G,maxTextureSize:q,maxCubemapSize:Y,maxAttributes:N,maxVertexUniforms:B,maxVaryings:D,maxFragmentUniforms:V,vertexTextures:h,maxSamples:C}}function Ak($){let J=this,Q=null,M=0,H=!1,K=!1,W=new r1,k=new x0,E={value:null,needsUpdate:!1};this.uniform=E,this.numPlanes=0,this.numIntersection=0,this.init=function(Z,U){let X=Z.length!==0||U||M!==0||H;return H=U,M=Z.length,X},this.beginShadows=function(){K=!0,R(null)},this.endShadows=function(){K=!1},this.setGlobalState=function(Z,U){Q=R(Z,U,0)},this.setState=function(Z,U,X){let{clippingPlanes:G,clipIntersection:q,clipShadows:Y}=Z,N=$.get(Z);if(!H||G===null||G.length===0||K&&!Y)if(K)R(null);else w();else{let B=K?0:M,D=B*4,V=N.clippingState||null;E.value=V,V=R(G,U,D,X);for(let h=0;h!==D;++h)V[h]=Q[h];N.clippingState=V,this.numIntersection=q?this.numPlanes:0,this.numPlanes+=B}};function w(){if(E.value!==Q)E.value=Q,E.needsUpdate=M>0;J.numPlanes=M,J.numIntersection=0}function R(Z,U,X,G){let q=Z!==null?Z.length:0,Y=null;if(q!==0){if(Y=E.value,G!==!0||Y===null){let N=X+q*4,B=U.matrixWorldInverse;if(k.getNormalMatrix(B),Y===null||Y.length<N)Y=new Float32Array(N);for(let D=0,V=X;D!==q;++D,V+=4)W.copy(Z[D]).applyMatrix4(B,k),W.normal.toArray(Y,V),Y[V+3]=W.constant}E.value=Y,E.needsUpdate=!0}return J.numPlanes=q,J.numIntersection=0,Y}}function Sk($){let J=new WeakMap;function Q(W,k){if(k===W$)W.mapping=_8;else if(k===k$)W.mapping=i5;return W}function M(W){if(W&&W.isTexture){let k=W.mapping;if(k===W$||k===k$)if(J.has(W)){let E=J.get(W).texture;return Q(E,W.mapping)}else{let E=W.image;if(E&&E.height>0){let w=new YJ(E.height);return w.fromEquirectangularTexture($,W),J.set(W,w),W.addEventListener("dispose",H),Q(w.texture,W.mapping)}else return null}}return W}function H(W){let k=W.target;k.removeEventListener("dispose",H);let E=J.get(k);if(E!==void 0)J.delete(k),E.dispose()}function K(){J=new WeakMap}return{get:M,dispose:K}}var b8=4,dQ=[0.125,0.215,0.35,0.446,0.526,0.582],W8=20,SJ=new X6,mQ=new r0,TJ=null,hJ=0,fJ=0,jJ=!1,K8=(1+Math.sqrt(5))/2,v8=1/K8,uQ=[new S(-K8,v8,0),new S(K8,v8,0),new S(-v8,0,K8),new S(v8,0,K8),new S(0,K8,-v8),new S(0,K8,v8),new S(-1,1,-1),new S(1,1,-1),new S(-1,1,1),new S(1,1,1)],Tk=new S;class vJ{constructor($){this._renderer=$,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene($,J=0,Q=0.1,M=100,H={}){let{size:K=256,position:W=Tk}=H;TJ=this._renderer.getRenderTarget(),hJ=this._renderer.getActiveCubeFace(),fJ=this._renderer.getActiveMipmapLevel(),jJ=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(K);let k=this._allocateTargets();if(k.depthBuffer=!0,this._sceneToCubeUV($,Q,M,k,W),J>0)this._blur(k,0,0,J);return this._applyPMREM(k),this._cleanup(k),k}fromEquirectangular($,J=null){return this._fromTexture($,J)}fromCubemap($,J=null){return this._fromTexture($,J)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=sQ(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=nQ(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose()}_setSize($){this._lodMax=Math.floor(Math.log2($)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let $=0;$<this._lodPlanes.length;$++)this._lodPlanes[$].dispose()}_cleanup($){this._renderer.setRenderTarget(TJ,hJ,fJ),this._renderer.xr.enabled=jJ,$.scissorTest=!1,C$($,0,0,$.width,$.height)}_fromTexture($,J){if($.mapping===_8||$.mapping===i5)this._setSize($.image.length===0?16:$.image[0].width||$.image[0].image.width);else this._setSize($.image.width/4);TJ=this._renderer.getRenderTarget(),hJ=this._renderer.getActiveCubeFace(),fJ=this._renderer.getActiveMipmapLevel(),jJ=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let Q=J||this._allocateTargets();return this._textureToCubeUV($,Q),this._applyPMREM(Q),this._cleanup(Q),Q}_allocateTargets(){let $=3*Math.max(this._cubeSize,112),J=4*this._cubeSize,Q={magFilter:a5,minFilter:a5,generateMipmaps:!1,type:k6,format:e1,colorSpace:w6,depthBuffer:!1},M=cQ($,J,Q);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==$||this._pingPongRenderTarget.height!==J){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=cQ($,J,Q);let{_lodMax:H}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=hk(H)),this._blurMaterial=fk(H,$,J)}return M}_compileMaterial($){let J=new f1(this._lodPlanes[0],$);this._renderer.compile(J,SJ)}_sceneToCubeUV($,J,Q,M,H){let k=new F1(90,1,J,Q),E=[1,-1,1,1,1,1],w=[1,1,1,-1,-1,-1],R=this._renderer,Z=R.autoClear,U=R.toneMapping;if(R.getClearColor(mQ),R.toneMapping=z5,R.autoClear=!1,R.state.buffers.depth.getReversed())R.setRenderTarget(M),R.clearDepth(),R.setRenderTarget(null);let G=new D$({name:"PMREM.Background",side:m1,depthWrite:!1,depthTest:!1}),q=new f1(new f8,G),Y=!1,N=$.background;if(N){if(N.isColor)G.color.copy(N),$.background=null,Y=!0}else G.color.copy(mQ),Y=!0;for(let B=0;B<6;B++){let D=B%3;if(D===0)k.up.set(0,E[B],0),k.position.set(H.x,H.y,H.z),k.lookAt(H.x+w[B],H.y,H.z);else if(D===1)k.up.set(0,0,E[B]),k.position.set(H.x,H.y,H.z),k.lookAt(H.x,H.y+w[B],H.z);else k.up.set(0,E[B],0),k.position.set(H.x,H.y,H.z),k.lookAt(H.x,H.y,H.z+w[B]);let V=this._cubeSize;if(C$(M,D*V,B>2?V:0,V,V),R.setRenderTarget(M),Y)R.render(q,k);R.render($,k)}q.geometry.dispose(),q.material.dispose(),R.toneMapping=U,R.autoClear=Z,$.background=N}_textureToCubeUV($,J){let Q=this._renderer,M=$.mapping===_8||$.mapping===i5;if(M){if(this._cubemapMaterial===null)this._cubemapMaterial=sQ();this._cubemapMaterial.uniforms.flipEnvMap.value=$.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=nQ();let H=M?this._cubemapMaterial:this._equirectMaterial,K=new f1(this._lodPlanes[0],H),W=H.uniforms;W.envMap.value=$;let k=this._cubeSize;C$(J,0,0,3*k,2*k),Q.setRenderTarget(J),Q.render(K,SJ)}_applyPMREM($){let J=this._renderer,Q=J.autoClear;J.autoClear=!1;let M=this._lodPlanes.length;for(let H=1;H<M;H++){let K=Math.sqrt(this._sigmas[H]*this._sigmas[H]-this._sigmas[H-1]*this._sigmas[H-1]),W=uQ[(M-H-1)%uQ.length];this._blur($,H-1,H,K,W)}J.autoClear=Q}_blur($,J,Q,M,H){let K=this._pingPongRenderTarget;this._halfBlur($,K,J,Q,M,"latitudinal",H),this._halfBlur(K,$,Q,Q,M,"longitudinal",H)}_halfBlur($,J,Q,M,H,K,W){let k=this._renderer,E=this._blurMaterial;if(K!=="latitudinal"&&K!=="longitudinal")console.error("blur direction must be either latitudinal or longitudinal!");let w=3,R=new f1(this._lodPlanes[M],E),Z=E.uniforms,U=this._sizeLods[Q]-1,X=isFinite(H)?Math.PI/(2*U):2*Math.PI/(2*W8-1),G=H/X,q=isFinite(H)?1+Math.floor(w*G):W8;if(q>W8)console.warn(`sigmaRadians, ${H}, is too large and will clip, as it requested ${q} samples when the maximum is set to ${W8}`);let Y=[],N=0;for(let C=0;C<W8;++C){let z=C/G,y=Math.exp(-z*z/2);if(Y.push(y),C===0)N+=y;else if(C<q)N+=2*y}for(let C=0;C<Y.length;C++)Y[C]=Y[C]/N;if(Z.envMap.value=$.texture,Z.samples.value=q,Z.weights.value=Y,Z.latitudinal.value=K==="latitudinal",W)Z.poleAxis.value=W;let{_lodMax:B}=this;Z.dTheta.value=X,Z.mipInt.value=B-Q;let D=this._sizeLods[M],V=3*D*(M>B-b8?M-B+b8:0),h=4*(this._cubeSize-D);C$(J,V,h,3*D,2*D),k.setRenderTarget(J),k.render(R,SJ)}}function hk($){let J=[],Q=[],M=[],H=$,K=$-b8+1+dQ.length;for(let W=0;W<K;W++){let k=Math.pow(2,H);Q.push(k);let E=1/k;if(W>$-b8)E=dQ[W-$+b8-1];else if(W===0)E=0;M.push(E);let w=1/(k-2),R=-w,Z=1+w,U=[R,R,Z,R,Z,Z,R,R,Z,Z,R,Z],X=6,G=6,q=3,Y=2,N=1,B=new Float32Array(q*G*X),D=new Float32Array(Y*G*X),V=new Float32Array(N*G*X);for(let C=0;C<X;C++){let z=C%3*2/3-1,y=C>2?0:-1,P=[z,y,0,z+0.6666666666666666,y,0,z+0.6666666666666666,y+1,0,z,y,0,z+0.6666666666666666,y+1,0,z,y+1,0];B.set(P,q*G*C),D.set(U,Y*G*C);let F=[C,C,C,C,C,C];V.set(F,N*G*C)}let h=new n1;if(h.setAttribute("position",new N1(B,q)),h.setAttribute("uv",new N1(D,Y)),h.setAttribute("faceIndex",new N1(V,N)),J.push(h),H>b8)H--}return{lodPlanes:J,sizeLods:Q,sigmas:M}}function cQ($,J,Q){let M=new $5($,J,Q);return M.texture.mapping=H6,M.texture.name="PMREM.cubeUv",M.scissorTest=!0,M}function C$($,J,Q,M,H){$.viewport.set(J,Q,M,H),$.scissor.set(J,Q,M,H)}function fk($,J,Q){let M=new Float32Array(W8),H=new S(0,1,0);return new J5({name:"SphericalGaussianBlur",defines:{n:W8,CUBEUV_TEXEL_WIDTH:1/J,CUBEUV_TEXEL_HEIGHT:1/Q,CUBEUV_MAX_MIP:`${$}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:M},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:H}},vertexShader:pJ(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:j5,depthTest:!1,depthWrite:!1})}function nQ(){return new J5({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:pJ(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:j5,depthTest:!1,depthWrite:!1})}function sQ(){return new J5({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:pJ(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:j5,depthTest:!1,depthWrite:!1})}function pJ(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function jk($){let J=new WeakMap,Q=null;function M(k){if(k&&k.isTexture){let E=k.mapping,w=E===W$||E===k$,R=E===_8||E===i5;if(w||R){let Z=J.get(k),U=Z!==void 0?Z.texture.pmremVersion:0;if(k.isRenderTargetTexture&&k.pmremVersion!==U){if(Q===null)Q=new vJ($);return Z=w?Q.fromEquirectangular(k,Z):Q.fromCubemap(k,Z),Z.texture.pmremVersion=k.pmremVersion,J.set(k,Z),Z.texture}else if(Z!==void 0)return Z.texture;else{let X=k.image;if(w&&X&&X.height>0||R&&X&&H(X)){if(Q===null)Q=new vJ($);return Z=w?Q.fromEquirectangular(k):Q.fromCubemap(k),Z.texture.pmremVersion=k.pmremVersion,J.set(k,Z),k.addEventListener("dispose",K),Z.texture}else return null}}}return k}function H(k){let E=0,w=6;for(let R=0;R<w;R++)if(k[R]!==void 0)E++;return E===w}function K(k){let E=k.target;E.removeEventListener("dispose",K);let w=J.get(E);if(w!==void 0)J.delete(E),w.dispose()}function W(){if(J=new WeakMap,Q!==null)Q.dispose(),Q=null}return{get:M,dispose:W}}function yk($){let J={};function Q(M){if(J[M]!==void 0)return J[M];let H;switch(M){case"WEBGL_depth_texture":H=$.getExtension("WEBGL_depth_texture")||$.getExtension("MOZ_WEBGL_depth_texture")||$.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":H=$.getExtension("EXT_texture_filter_anisotropic")||$.getExtension("MOZ_EXT_texture_filter_anisotropic")||$.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":H=$.getExtension("WEBGL_compressed_texture_s3tc")||$.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||$.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":H=$.getExtension("WEBGL_compressed_texture_pvrtc")||$.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:H=$.getExtension(M)}return J[M]=H,H}return{has:function(M){return Q(M)!==null},init:function(){Q("EXT_color_buffer_float"),Q("WEBGL_clip_cull_distance"),Q("OES_texture_float_linear"),Q("EXT_color_buffer_half_float"),Q("WEBGL_multisampled_render_to_texture"),Q("WEBGL_render_shared_exponent")},get:function(M){let H=Q(M);if(H===null)o5("THREE.WebGLRenderer: "+M+" extension not supported.");return H}}}function vk($,J,Q,M){let H={},K=new WeakMap;function W(Z){let U=Z.target;if(U.index!==null)J.remove(U.index);for(let G in U.attributes)J.remove(U.attributes[G]);U.removeEventListener("dispose",W),delete H[U.id];let X=K.get(U);if(X)J.remove(X),K.delete(U);if(M.releaseStatesOfGeometry(U),U.isInstancedBufferGeometry===!0)delete U._maxInstanceCount;Q.memory.geometries--}function k(Z,U){if(H[U.id]===!0)return U;return U.addEventListener("dispose",W),H[U.id]=!0,Q.memory.geometries++,U}function E(Z){let U=Z.attributes;for(let X in U)J.update(U[X],$.ARRAY_BUFFER)}function w(Z){let U=[],X=Z.index,G=Z.attributes.position,q=0;if(X!==null){let B=X.array;q=X.version;for(let D=0,V=B.length;D<V;D+=3){let h=B[D+0],C=B[D+1],z=B[D+2];U.push(h,C,C,z,z,h)}}else if(G!==void 0){let B=G.array;q=G.version;for(let D=0,V=B.length/3-1;D<V;D+=3){let h=D+0,C=D+1,z=D+2;U.push(h,C,C,z,z,h)}}else return;let Y=new((kJ(U))?O$:q$)(U,1);Y.version=q;let N=K.get(Z);if(N)J.remove(N);K.set(Z,Y)}function R(Z){let U=K.get(Z);if(U){let X=Z.index;if(X!==null){if(U.version<X.version)w(Z)}}else w(Z);return K.get(Z)}return{get:k,update:E,getWireframeAttribute:R}}function bk($,J,Q){let M;function H(U){M=U}let K,W;function k(U){K=U.type,W=U.bytesPerElement}function E(U,X){$.drawElements(M,X,K,U*W),Q.update(X,M,1)}function w(U,X,G){if(G===0)return;$.drawElementsInstanced(M,X,K,U*W,G),Q.update(X,M,G)}function R(U,X,G){if(G===0)return;J.get("WEBGL_multi_draw").multiDrawElementsWEBGL(M,X,0,K,U,0,G);let Y=0;for(let N=0;N<G;N++)Y+=X[N];Q.update(Y,M,1)}function Z(U,X,G,q){if(G===0)return;let Y=J.get("WEBGL_multi_draw");if(Y===null)for(let N=0;N<U.length;N++)w(U[N]/W,X[N],q[N]);else{Y.multiDrawElementsInstancedWEBGL(M,X,0,K,U,0,q,0,G);let N=0;for(let B=0;B<G;B++)N+=X[B]*q[B];Q.update(N,M,1)}}this.setMode=H,this.setIndex=k,this.render=E,this.renderInstances=w,this.renderMultiDraw=R,this.renderMultiDrawInstances=Z}function pk($){let J={geometries:0,textures:0},Q={frame:0,calls:0,triangles:0,points:0,lines:0};function M(K,W,k){switch(Q.calls++,W){case $.TRIANGLES:Q.triangles+=k*(K/3);break;case $.LINES:Q.lines+=k*(K/2);break;case $.LINE_STRIP:Q.lines+=k*(K-1);break;case $.LINE_LOOP:Q.lines+=k*K;break;case $.POINTS:Q.points+=k*K;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",W);break}}function H(){Q.calls=0,Q.triangles=0,Q.points=0,Q.lines=0}return{memory:J,render:Q,programs:null,autoReset:!0,reset:H,update:M}}function xk($,J,Q){let M=new WeakMap,H=new U1;function K(W,k,E){let w=W.morphTargetInfluences,R=k.morphAttributes.position||k.morphAttributes.normal||k.morphAttributes.color,Z=R!==void 0?R.length:0,U=M.get(k);if(U===void 0||U.count!==Z){let P=function(){z.dispose(),M.delete(k),k.removeEventListener("dispose",P)};if(U!==void 0)U.texture.dispose();let X=k.morphAttributes.position!==void 0,G=k.morphAttributes.normal!==void 0,q=k.morphAttributes.color!==void 0,Y=k.morphAttributes.position||[],N=k.morphAttributes.normal||[],B=k.morphAttributes.color||[],D=0;if(X===!0)D=1;if(G===!0)D=2;if(q===!0)D=3;let V=k.attributes.position.count*D,h=1;if(V>J.maxTextureSize)h=Math.ceil(V/J.maxTextureSize),V=J.maxTextureSize;let C=new Float32Array(V*h*4*Z),z=new X$(C,V,h,Z);z.type=y5,z.needsUpdate=!0;let y=D*4;for(let F=0;F<Z;F++){let f=Y[F],u=N[F],x=B[F],c=V*h*4*F;for(let t=0;t<f.count;t++){let d=t*y;if(X===!0)H.fromBufferAttribute(f,t),C[c+d+0]=H.x,C[c+d+1]=H.y,C[c+d+2]=H.z,C[c+d+3]=0;if(G===!0)H.fromBufferAttribute(u,t),C[c+d+4]=H.x,C[c+d+5]=H.y,C[c+d+6]=H.z,C[c+d+7]=0;if(q===!0)H.fromBufferAttribute(x,t),C[c+d+8]=H.x,C[c+d+9]=H.y,C[c+d+10]=H.z,C[c+d+11]=x.itemSize===4?H.w:1}}U={count:Z,texture:z,size:new $1(V,h)},M.set(k,U),k.addEventListener("dispose",P)}if(W.isInstancedMesh===!0&&W.morphTexture!==null)E.getUniforms().setValue($,"morphTexture",W.morphTexture,Q);else{let X=0;for(let q=0;q<w.length;q++)X+=w[q];let G=k.morphTargetsRelative?1:1-X;E.getUniforms().setValue($,"morphTargetBaseInfluence",G),E.getUniforms().setValue($,"morphTargetInfluences",w)}E.getUniforms().setValue($,"morphTargetsTexture",U.texture,Q),E.getUniforms().setValue($,"morphTargetsTextureSize",U.size)}return{update:K}}function gk($,J,Q,M){let H=new WeakMap;function K(E){let w=M.render.frame,R=E.geometry,Z=J.get(E,R);if(H.get(Z)!==w)J.update(Z),H.set(Z,w);if(E.isInstancedMesh){if(E.hasEventListener("dispose",k)===!1)E.addEventListener("dispose",k);if(H.get(E)!==w){if(Q.update(E.instanceMatrix,$.ARRAY_BUFFER),E.instanceColor!==null)Q.update(E.instanceColor,$.ARRAY_BUFFER);H.set(E,w)}}if(E.isSkinnedMesh){let U=E.skeleton;if(H.get(U)!==w)U.update(),H.set(U,w)}return Z}function W(){H=new WeakMap}function k(E){let w=E.target;if(w.removeEventListener("dispose",k),Q.remove(w.instanceMatrix),w.instanceColor!==null)Q.remove(w.instanceColor)}return{update:K,dispose:W}}var UM=new A1,oQ=new j8(1,1),YM=new X$,NM=new ZJ,XM=new L$,iQ=[],aQ=[],rQ=new Float32Array(16),tQ=new Float32Array(9),eQ=new Float32Array(4);function p8($,J,Q){let M=$[0];if(M<=0||M>0)return $;let H=J*Q,K=iQ[H];if(K===void 0)K=new Float32Array(H),iQ[H]=K;if(J!==0){M.toArray(K,0);for(let W=1,k=0;W!==J;++W)k+=Q,$[W].toArray(K,k)}return K}function G1($,J){if($.length!==J.length)return!1;for(let Q=0,M=$.length;Q<M;Q++)if($[Q]!==J[Q])return!1;return!0}function D1($,J){for(let Q=0,M=J.length;Q<M;Q++)$[Q]=J[Q]}function A$($,J){let Q=aQ[J];if(Q===void 0)Q=new Int32Array(J),aQ[J]=Q;for(let M=0;M!==J;++M)Q[M]=$.allocateTextureUnit();return Q}function lk($,J){let Q=this.cache;if(Q[0]===J)return;$.uniform1f(this.addr,J),Q[0]=J}function dk($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y)$.uniform2f(this.addr,J.x,J.y),Q[0]=J.x,Q[1]=J.y}else{if(G1(Q,J))return;$.uniform2fv(this.addr,J),D1(Q,J)}}function mk($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y||Q[2]!==J.z)$.uniform3f(this.addr,J.x,J.y,J.z),Q[0]=J.x,Q[1]=J.y,Q[2]=J.z}else if(J.r!==void 0){if(Q[0]!==J.r||Q[1]!==J.g||Q[2]!==J.b)$.uniform3f(this.addr,J.r,J.g,J.b),Q[0]=J.r,Q[1]=J.g,Q[2]=J.b}else{if(G1(Q,J))return;$.uniform3fv(this.addr,J),D1(Q,J)}}function uk($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y||Q[2]!==J.z||Q[3]!==J.w)$.uniform4f(this.addr,J.x,J.y,J.z,J.w),Q[0]=J.x,Q[1]=J.y,Q[2]=J.z,Q[3]=J.w}else{if(G1(Q,J))return;$.uniform4fv(this.addr,J),D1(Q,J)}}function ck($,J){let Q=this.cache,M=J.elements;if(M===void 0){if(G1(Q,J))return;$.uniformMatrix2fv(this.addr,!1,J),D1(Q,J)}else{if(G1(Q,M))return;eQ.set(M),$.uniformMatrix2fv(this.addr,!1,eQ),D1(Q,M)}}function nk($,J){let Q=this.cache,M=J.elements;if(M===void 0){if(G1(Q,J))return;$.uniformMatrix3fv(this.addr,!1,J),D1(Q,J)}else{if(G1(Q,M))return;tQ.set(M),$.uniformMatrix3fv(this.addr,!1,tQ),D1(Q,M)}}function sk($,J){let Q=this.cache,M=J.elements;if(M===void 0){if(G1(Q,J))return;$.uniformMatrix4fv(this.addr,!1,J),D1(Q,J)}else{if(G1(Q,M))return;rQ.set(M),$.uniformMatrix4fv(this.addr,!1,rQ),D1(Q,M)}}function ok($,J){let Q=this.cache;if(Q[0]===J)return;$.uniform1i(this.addr,J),Q[0]=J}function ik($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y)$.uniform2i(this.addr,J.x,J.y),Q[0]=J.x,Q[1]=J.y}else{if(G1(Q,J))return;$.uniform2iv(this.addr,J),D1(Q,J)}}function ak($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y||Q[2]!==J.z)$.uniform3i(this.addr,J.x,J.y,J.z),Q[0]=J.x,Q[1]=J.y,Q[2]=J.z}else{if(G1(Q,J))return;$.uniform3iv(this.addr,J),D1(Q,J)}}function rk($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y||Q[2]!==J.z||Q[3]!==J.w)$.uniform4i(this.addr,J.x,J.y,J.z,J.w),Q[0]=J.x,Q[1]=J.y,Q[2]=J.z,Q[3]=J.w}else{if(G1(Q,J))return;$.uniform4iv(this.addr,J),D1(Q,J)}}function tk($,J){let Q=this.cache;if(Q[0]===J)return;$.uniform1ui(this.addr,J),Q[0]=J}function ek($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y)$.uniform2ui(this.addr,J.x,J.y),Q[0]=J.x,Q[1]=J.y}else{if(G1(Q,J))return;$.uniform2uiv(this.addr,J),D1(Q,J)}}function $E($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y||Q[2]!==J.z)$.uniform3ui(this.addr,J.x,J.y,J.z),Q[0]=J.x,Q[1]=J.y,Q[2]=J.z}else{if(G1(Q,J))return;$.uniform3uiv(this.addr,J),D1(Q,J)}}function JE($,J){let Q=this.cache;if(J.x!==void 0){if(Q[0]!==J.x||Q[1]!==J.y||Q[2]!==J.z||Q[3]!==J.w)$.uniform4ui(this.addr,J.x,J.y,J.z,J.w),Q[0]=J.x,Q[1]=J.y,Q[2]=J.z,Q[3]=J.w}else{if(G1(Q,J))return;$.uniform4uiv(this.addr,J),D1(Q,J)}}function QE($,J,Q){let M=this.cache,H=Q.allocateTextureUnit();if(M[0]!==H)$.uniform1i(this.addr,H),M[0]=H;let K;if(this.type===$.SAMPLER_2D_SHADOW)oQ.compareFunction=HJ,K=oQ;else K=UM;Q.setTexture2D(J||K,H)}function ME($,J,Q){let M=this.cache,H=Q.allocateTextureUnit();if(M[0]!==H)$.uniform1i(this.addr,H),M[0]=H;Q.setTexture3D(J||NM,H)}function HE($,J,Q){let M=this.cache,H=Q.allocateTextureUnit();if(M[0]!==H)$.uniform1i(this.addr,H),M[0]=H;Q.setTextureCube(J||XM,H)}function KE($,J,Q){let M=this.cache,H=Q.allocateTextureUnit();if(M[0]!==H)$.uniform1i(this.addr,H),M[0]=H;Q.setTexture2DArray(J||YM,H)}function WE($){switch($){case 5126:return lk;case 35664:return dk;case 35665:return mk;case 35666:return uk;case 35674:return ck;case 35675:return nk;case 35676:return sk;case 5124:case 35670:return ok;case 35667:case 35671:return ik;case 35668:case 35672:return ak;case 35669:case 35673:return rk;case 5125:return tk;case 36294:return ek;case 36295:return $E;case 36296:return JE;case 35678:case 36198:case 36298:case 36306:case 35682:return QE;case 35679:case 36299:case 36307:return ME;case 35680:case 36300:case 36308:case 36293:return HE;case 36289:case 36303:case 36311:case 36292:return KE}}function kE($,J){$.uniform1fv(this.addr,J)}function EE($,J){let Q=p8(J,this.size,2);$.uniform2fv(this.addr,Q)}function wE($,J){let Q=p8(J,this.size,3);$.uniform3fv(this.addr,Q)}function ZE($,J){let Q=p8(J,this.size,4);$.uniform4fv(this.addr,Q)}function RE($,J){let Q=p8(J,this.size,4);$.uniformMatrix2fv(this.addr,!1,Q)}function UE($,J){let Q=p8(J,this.size,9);$.uniformMatrix3fv(this.addr,!1,Q)}function YE($,J){let Q=p8(J,this.size,16);$.uniformMatrix4fv(this.addr,!1,Q)}function NE($,J){$.uniform1iv(this.addr,J)}function XE($,J){$.uniform2iv(this.addr,J)}function GE($,J){$.uniform3iv(this.addr,J)}function DE($,J){$.uniform4iv(this.addr,J)}function qE($,J){$.uniform1uiv(this.addr,J)}function OE($,J){$.uniform2uiv(this.addr,J)}function FE($,J){$.uniform3uiv(this.addr,J)}function LE($,J){$.uniform4uiv(this.addr,J)}function PE($,J,Q){let M=this.cache,H=J.length,K=A$(Q,H);if(!G1(M,K))$.uniform1iv(this.addr,K),D1(M,K);for(let W=0;W!==H;++W)Q.setTexture2D(J[W]||UM,K[W])}function VE($,J,Q){let M=this.cache,H=J.length,K=A$(Q,H);if(!G1(M,K))$.uniform1iv(this.addr,K),D1(M,K);for(let W=0;W!==H;++W)Q.setTexture3D(J[W]||NM,K[W])}function zE($,J,Q){let M=this.cache,H=J.length,K=A$(Q,H);if(!G1(M,K))$.uniform1iv(this.addr,K),D1(M,K);for(let W=0;W!==H;++W)Q.setTextureCube(J[W]||XM,K[W])}function BE($,J,Q){let M=this.cache,H=J.length,K=A$(Q,H);if(!G1(M,K))$.uniform1iv(this.addr,K),D1(M,K);for(let W=0;W!==H;++W)Q.setTexture2DArray(J[W]||YM,K[W])}function IE($){switch($){case 5126:return kE;case 35664:return EE;case 35665:return wE;case 35666:return ZE;case 35674:return RE;case 35675:return UE;case 35676:return YE;case 5124:case 35670:return NE;case 35667:case 35671:return XE;case 35668:case 35672:return GE;case 35669:case 35673:return DE;case 5125:return qE;case 36294:return OE;case 36295:return FE;case 36296:return LE;case 35678:case 36198:case 36298:case 36306:case 35682:return PE;case 35679:case 36299:case 36307:return VE;case 35680:case 36300:case 36308:case 36293:return zE;case 36289:case 36303:case 36311:case 36292:return BE}}class GM{constructor($,J,Q){this.id=$,this.addr=Q,this.cache=[],this.type=J.type,this.setValue=WE(J.type)}}class DM{constructor($,J,Q){this.id=$,this.addr=Q,this.cache=[],this.type=J.type,this.size=J.size,this.setValue=IE(J.type)}}class qM{constructor($){this.id=$,this.seq=[],this.map={}}setValue($,J,Q){let M=this.seq;for(let H=0,K=M.length;H!==K;++H){let W=M[H];W.setValue($,J[W.id],Q)}}}var yJ=/(\w+)(\])?(\[|\.)?/g;function $M($,J){$.seq.push(J),$.map[J.id]=J}function CE($,J,Q){let M=$.name,H=M.length;yJ.lastIndex=0;while(!0){let K=yJ.exec(M),W=yJ.lastIndex,k=K[1],E=K[2]==="]",w=K[3];if(E)k=k|0;if(w===void 0||w==="["&&W+2===H){$M(Q,w===void 0?new GM(k,$,J):new DM(k,$,J));break}else{let Z=Q.map[k];if(Z===void 0)Z=new qM(k),$M(Q,Z);Q=Z}}}class D6{constructor($,J){this.seq=[],this.map={};let Q=$.getProgramParameter(J,$.ACTIVE_UNIFORMS);for(let M=0;M<Q;++M){let H=$.getActiveUniform(J,M),K=$.getUniformLocation(J,H.name);CE(H,K,this)}}setValue($,J,Q,M){let H=this.map[J];if(H!==void 0)H.setValue($,Q,M)}setOptional($,J,Q){let M=J[Q];if(M!==void 0)this.setValue($,Q,M)}static upload($,J,Q,M){for(let H=0,K=J.length;H!==K;++H){let W=J[H],k=Q[W.id];if(k.needsUpdate!==!1)W.setValue($,k.value,M)}}static seqWithValue($,J){let Q=[];for(let M=0,H=$.length;M!==H;++M){let K=$[M];if(K.id in J)Q.push(K)}return Q}}function JM($,J,Q){let M=$.createShader(J);return $.shaderSource(M,Q),$.compileShader(M),M}var _E=37297,AE=0;function SE($,J){let Q=$.split(`
`),M=[],H=Math.max(J-6,0),K=Math.min(J+6,Q.length);for(let W=H;W<K;W++){let k=W+1;M.push(`${k===J?">":" "} ${k}: ${Q[W]}`)}return M.join(`
`)}var QM=new x0;function TE($){i0._getMatrix(QM,i0.workingColorSpace,$);let J=`mat3( ${QM.elements.map((Q)=>Q.toFixed(4))} )`;switch(i0.getTransfer($)){case MJ:return[J,"LinearTransferOETF"];case K1:return[J,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",$),[J,"LinearTransferOETF"]}}function MM($,J,Q){let M=$.getShaderParameter(J,$.COMPILE_STATUS),K=($.getShaderInfoLog(J)||"").trim();if(M&&K==="")return"";let W=/ERROR: 0:(\d+)/.exec(K);if(W){let k=parseInt(W[1]);return Q.toUpperCase()+`

`+K+`

`+SE($.getShaderSource(J),k)}else return K}function hE($,J){let Q=TE(J);return[`vec4 ${$}( vec4 value ) {`,`	return ${Q[1]}( vec4( value.rgb * ${Q[0]}, value.a ) );`,"}"].join(`
`)}function fE($,J){let Q;switch(J){case WQ:Q="Linear";break;case kQ:Q="Reinhard";break;case EQ:Q="Cineon";break;case wQ:Q="ACESFilmic";break;case RQ:Q="AgX";break;case UQ:Q="Neutral";break;case ZQ:Q="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",J),Q="Linear"}return"vec3 "+$+"( vec3 color ) { return "+Q+"ToneMapping( color ); }"}var _$=new S;function jE(){i0.getLuminanceCoefficients(_$);let $=_$.x.toFixed(4),J=_$.y.toFixed(4),Q=_$.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${$}, ${J}, ${Q} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function yE($){return[$.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",$.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(G6).join(`
`)}function vE($){let J=[];for(let Q in $){let M=$[Q];if(M===!1)continue;J.push("#define "+Q+" "+M)}return J.join(`
`)}function bE($,J){let Q={},M=$.getProgramParameter(J,$.ACTIVE_ATTRIBUTES);for(let H=0;H<M;H++){let K=$.getActiveAttrib(J,H),W=K.name,k=1;if(K.type===$.FLOAT_MAT2)k=2;if(K.type===$.FLOAT_MAT3)k=3;if(K.type===$.FLOAT_MAT4)k=4;Q[W]={type:K.type,location:$.getAttribLocation(J,W),locationSize:k}}return Q}function G6($){return $!==""}function HM($,J){let Q=J.numSpotLightShadows+J.numSpotLightMaps-J.numSpotLightShadowsWithMaps;return $.replace(/NUM_DIR_LIGHTS/g,J.numDirLights).replace(/NUM_SPOT_LIGHTS/g,J.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,J.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,Q).replace(/NUM_RECT_AREA_LIGHTS/g,J.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,J.numPointLights).replace(/NUM_HEMI_LIGHTS/g,J.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,J.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,J.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,J.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,J.numPointLightShadows)}function KM($,J){return $.replace(/NUM_CLIPPING_PLANES/g,J.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,J.numClippingPlanes-J.numClipIntersection)}var pE=/^[ \t]*#include +<([\w\d./]+)>/gm;function bJ($){return $.replace(pE,gE)}var xE=new Map;function gE($,J){let Q=g0[J];if(Q===void 0){let M=xE.get(J);if(M!==void 0)Q=g0[M],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',J,M);else throw Error("Can not resolve #include <"+J+">")}return bJ(Q)}var lE=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function WM($){return $.replace(lE,dE)}function dE($,J,Q,M){let H="";for(let K=parseInt(J);K<parseInt(Q);K++)H+=M.replace(/\[\s*i\s*\]/g,"[ "+K+" ]").replace(/UNROLLED_LOOP_INDEX/g,K);return H}function kM($){let J=`precision ${$.precision} float;
	precision ${$.precision} int;
	precision ${$.precision} sampler2D;
	precision ${$.precision} samplerCube;
	precision ${$.precision} sampler3D;
	precision ${$.precision} sampler2DArray;
	precision ${$.precision} sampler2DShadow;
	precision ${$.precision} samplerCubeShadow;
	precision ${$.precision} sampler2DArrayShadow;
	precision ${$.precision} isampler2D;
	precision ${$.precision} isampler3D;
	precision ${$.precision} isamplerCube;
	precision ${$.precision} isampler2DArray;
	precision ${$.precision} usampler2D;
	precision ${$.precision} usampler3D;
	precision ${$.precision} usamplerCube;
	precision ${$.precision} usampler2DArray;
	`;if($.precision==="highp")J+=`
#define HIGH_PRECISION`;else if($.precision==="mediump")J+=`
#define MEDIUM_PRECISION`;else if($.precision==="lowp")J+=`
#define LOW_PRECISION`;return J}function mE($){let J="SHADOWMAP_TYPE_BASIC";if($.shadowMapType===L9)J="SHADOWMAP_TYPE_PCF";else if($.shadowMapType===v7)J="SHADOWMAP_TYPE_PCF_SOFT";else if($.shadowMapType===Z5)J="SHADOWMAP_TYPE_VSM";return J}function uE($){let J="ENVMAP_TYPE_CUBE";if($.envMap)switch($.envMapMode){case _8:case i5:J="ENVMAP_TYPE_CUBE";break;case H6:J="ENVMAP_TYPE_CUBE_UV";break}return J}function cE($){let J="ENVMAP_MODE_REFLECTION";if($.envMap)switch($.envMapMode){case i5:J="ENVMAP_MODE_REFRACTION";break}return J}function nE($){let J="ENVMAP_BLENDING_NONE";if($.envMap)switch($.combine){case MQ:J="ENVMAP_BLENDING_MULTIPLY";break;case HQ:J="ENVMAP_BLENDING_MIX";break;case KQ:J="ENVMAP_BLENDING_ADD";break}return J}function sE($){let J=$.envMapCubeUVHeight;if(J===null)return null;let Q=Math.log2(J)-2,M=1/J;return{texelWidth:1/(3*Math.max(Math.pow(2,Q),112)),texelHeight:M,maxMip:Q}}function oE($,J,Q,M){let H=$.getContext(),K=Q.defines,W=Q.vertexShader,k=Q.fragmentShader,E=mE(Q),w=uE(Q),R=cE(Q),Z=nE(Q),U=sE(Q),X=yE(Q),G=vE(K),q=H.createProgram(),Y,N,B=Q.glslVersion?"#version "+Q.glslVersion+`
`:"";if(Q.isRawShaderMaterial){if(Y=["#define SHADER_TYPE "+Q.shaderType,"#define SHADER_NAME "+Q.shaderName,G].filter(G6).join(`
`),Y.length>0)Y+=`
`;if(N=["#define SHADER_TYPE "+Q.shaderType,"#define SHADER_NAME "+Q.shaderName,G].filter(G6).join(`
`),N.length>0)N+=`
`}else Y=[kM(Q),"#define SHADER_TYPE "+Q.shaderType,"#define SHADER_NAME "+Q.shaderName,G,Q.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",Q.batching?"#define USE_BATCHING":"",Q.batchingColor?"#define USE_BATCHING_COLOR":"",Q.instancing?"#define USE_INSTANCING":"",Q.instancingColor?"#define USE_INSTANCING_COLOR":"",Q.instancingMorph?"#define USE_INSTANCING_MORPH":"",Q.useFog&&Q.fog?"#define USE_FOG":"",Q.useFog&&Q.fogExp2?"#define FOG_EXP2":"",Q.map?"#define USE_MAP":"",Q.envMap?"#define USE_ENVMAP":"",Q.envMap?"#define "+R:"",Q.lightMap?"#define USE_LIGHTMAP":"",Q.aoMap?"#define USE_AOMAP":"",Q.bumpMap?"#define USE_BUMPMAP":"",Q.normalMap?"#define USE_NORMALMAP":"",Q.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",Q.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",Q.displacementMap?"#define USE_DISPLACEMENTMAP":"",Q.emissiveMap?"#define USE_EMISSIVEMAP":"",Q.anisotropy?"#define USE_ANISOTROPY":"",Q.anisotropyMap?"#define USE_ANISOTROPYMAP":"",Q.clearcoatMap?"#define USE_CLEARCOATMAP":"",Q.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",Q.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",Q.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",Q.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",Q.specularMap?"#define USE_SPECULARMAP":"",Q.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",Q.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",Q.roughnessMap?"#define USE_ROUGHNESSMAP":"",Q.metalnessMap?"#define USE_METALNESSMAP":"",Q.alphaMap?"#define USE_ALPHAMAP":"",Q.alphaHash?"#define USE_ALPHAHASH":"",Q.transmission?"#define USE_TRANSMISSION":"",Q.transmissionMap?"#define USE_TRANSMISSIONMAP":"",Q.thicknessMap?"#define USE_THICKNESSMAP":"",Q.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",Q.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",Q.mapUv?"#define MAP_UV "+Q.mapUv:"",Q.alphaMapUv?"#define ALPHAMAP_UV "+Q.alphaMapUv:"",Q.lightMapUv?"#define LIGHTMAP_UV "+Q.lightMapUv:"",Q.aoMapUv?"#define AOMAP_UV "+Q.aoMapUv:"",Q.emissiveMapUv?"#define EMISSIVEMAP_UV "+Q.emissiveMapUv:"",Q.bumpMapUv?"#define BUMPMAP_UV "+Q.bumpMapUv:"",Q.normalMapUv?"#define NORMALMAP_UV "+Q.normalMapUv:"",Q.displacementMapUv?"#define DISPLACEMENTMAP_UV "+Q.displacementMapUv:"",Q.metalnessMapUv?"#define METALNESSMAP_UV "+Q.metalnessMapUv:"",Q.roughnessMapUv?"#define ROUGHNESSMAP_UV "+Q.roughnessMapUv:"",Q.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+Q.anisotropyMapUv:"",Q.clearcoatMapUv?"#define CLEARCOATMAP_UV "+Q.clearcoatMapUv:"",Q.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+Q.clearcoatNormalMapUv:"",Q.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+Q.clearcoatRoughnessMapUv:"",Q.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+Q.iridescenceMapUv:"",Q.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+Q.iridescenceThicknessMapUv:"",Q.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+Q.sheenColorMapUv:"",Q.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+Q.sheenRoughnessMapUv:"",Q.specularMapUv?"#define SPECULARMAP_UV "+Q.specularMapUv:"",Q.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+Q.specularColorMapUv:"",Q.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+Q.specularIntensityMapUv:"",Q.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+Q.transmissionMapUv:"",Q.thicknessMapUv?"#define THICKNESSMAP_UV "+Q.thicknessMapUv:"",Q.vertexTangents&&Q.flatShading===!1?"#define USE_TANGENT":"",Q.vertexColors?"#define USE_COLOR":"",Q.vertexAlphas?"#define USE_COLOR_ALPHA":"",Q.vertexUv1s?"#define USE_UV1":"",Q.vertexUv2s?"#define USE_UV2":"",Q.vertexUv3s?"#define USE_UV3":"",Q.pointsUvs?"#define USE_POINTS_UV":"",Q.flatShading?"#define FLAT_SHADED":"",Q.skinning?"#define USE_SKINNING":"",Q.morphTargets?"#define USE_MORPHTARGETS":"",Q.morphNormals&&Q.flatShading===!1?"#define USE_MORPHNORMALS":"",Q.morphColors?"#define USE_MORPHCOLORS":"",Q.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+Q.morphTextureStride:"",Q.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+Q.morphTargetsCount:"",Q.doubleSided?"#define DOUBLE_SIDED":"",Q.flipSided?"#define FLIP_SIDED":"",Q.shadowMapEnabled?"#define USE_SHADOWMAP":"",Q.shadowMapEnabled?"#define "+E:"",Q.sizeAttenuation?"#define USE_SIZEATTENUATION":"",Q.numLightProbes>0?"#define USE_LIGHT_PROBES":"",Q.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",Q.reversedDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(G6).join(`
`),N=[kM(Q),"#define SHADER_TYPE "+Q.shaderType,"#define SHADER_NAME "+Q.shaderName,G,Q.useFog&&Q.fog?"#define USE_FOG":"",Q.useFog&&Q.fogExp2?"#define FOG_EXP2":"",Q.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",Q.map?"#define USE_MAP":"",Q.matcap?"#define USE_MATCAP":"",Q.envMap?"#define USE_ENVMAP":"",Q.envMap?"#define "+w:"",Q.envMap?"#define "+R:"",Q.envMap?"#define "+Z:"",U?"#define CUBEUV_TEXEL_WIDTH "+U.texelWidth:"",U?"#define CUBEUV_TEXEL_HEIGHT "+U.texelHeight:"",U?"#define CUBEUV_MAX_MIP "+U.maxMip+".0":"",Q.lightMap?"#define USE_LIGHTMAP":"",Q.aoMap?"#define USE_AOMAP":"",Q.bumpMap?"#define USE_BUMPMAP":"",Q.normalMap?"#define USE_NORMALMAP":"",Q.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",Q.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",Q.emissiveMap?"#define USE_EMISSIVEMAP":"",Q.anisotropy?"#define USE_ANISOTROPY":"",Q.anisotropyMap?"#define USE_ANISOTROPYMAP":"",Q.clearcoat?"#define USE_CLEARCOAT":"",Q.clearcoatMap?"#define USE_CLEARCOATMAP":"",Q.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",Q.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",Q.dispersion?"#define USE_DISPERSION":"",Q.iridescence?"#define USE_IRIDESCENCE":"",Q.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",Q.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",Q.specularMap?"#define USE_SPECULARMAP":"",Q.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",Q.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",Q.roughnessMap?"#define USE_ROUGHNESSMAP":"",Q.metalnessMap?"#define USE_METALNESSMAP":"",Q.alphaMap?"#define USE_ALPHAMAP":"",Q.alphaTest?"#define USE_ALPHATEST":"",Q.alphaHash?"#define USE_ALPHAHASH":"",Q.sheen?"#define USE_SHEEN":"",Q.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",Q.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",Q.transmission?"#define USE_TRANSMISSION":"",Q.transmissionMap?"#define USE_TRANSMISSIONMAP":"",Q.thicknessMap?"#define USE_THICKNESSMAP":"",Q.vertexTangents&&Q.flatShading===!1?"#define USE_TANGENT":"",Q.vertexColors||Q.instancingColor||Q.batchingColor?"#define USE_COLOR":"",Q.vertexAlphas?"#define USE_COLOR_ALPHA":"",Q.vertexUv1s?"#define USE_UV1":"",Q.vertexUv2s?"#define USE_UV2":"",Q.vertexUv3s?"#define USE_UV3":"",Q.pointsUvs?"#define USE_POINTS_UV":"",Q.gradientMap?"#define USE_GRADIENTMAP":"",Q.flatShading?"#define FLAT_SHADED":"",Q.doubleSided?"#define DOUBLE_SIDED":"",Q.flipSided?"#define FLIP_SIDED":"",Q.shadowMapEnabled?"#define USE_SHADOWMAP":"",Q.shadowMapEnabled?"#define "+E:"",Q.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",Q.numLightProbes>0?"#define USE_LIGHT_PROBES":"",Q.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",Q.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",Q.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",Q.reversedDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",Q.toneMapping!==z5?"#define TONE_MAPPING":"",Q.toneMapping!==z5?g0.tonemapping_pars_fragment:"",Q.toneMapping!==z5?fE("toneMapping",Q.toneMapping):"",Q.dithering?"#define DITHERING":"",Q.opaque?"#define OPAQUE":"",g0.colorspace_pars_fragment,hE("linearToOutputTexel",Q.outputColorSpace),jE(),Q.useDepthPacking?"#define DEPTH_PACKING "+Q.depthPacking:"",`
`].filter(G6).join(`
`);if(W=bJ(W),W=HM(W,Q),W=KM(W,Q),k=bJ(k),k=HM(k,Q),k=KM(k,Q),W=WM(W),k=WM(k),Q.isRawShaderMaterial!==!0)B=`#version 300 es
`,Y=[X,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+Y,N=["#define varying in",Q.glslVersion===KJ?"":"layout(location = 0) out highp vec4 pc_fragColor;",Q.glslVersion===KJ?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+N;let D=B+Y+W,V=B+N+k,h=JM(H,H.VERTEX_SHADER,D),C=JM(H,H.FRAGMENT_SHADER,V);if(H.attachShader(q,h),H.attachShader(q,C),Q.index0AttributeName!==void 0)H.bindAttribLocation(q,0,Q.index0AttributeName);else if(Q.morphTargets===!0)H.bindAttribLocation(q,0,"position");H.linkProgram(q);function z(f){if($.debug.checkShaderErrors){let u=H.getProgramInfoLog(q)||"",x=H.getShaderInfoLog(h)||"",c=H.getShaderInfoLog(C)||"",t=u.trim(),d=x.trim(),e=c.trim(),g=!0,W0=!0;if(H.getProgramParameter(q,H.LINK_STATUS)===!1)if(g=!1,typeof $.debug.onShaderError==="function")$.debug.onShaderError(H,q,h,C);else{let w0=MM(H,h,"vertex"),z0=MM(H,C,"fragment");console.error("THREE.WebGLProgram: Shader Error "+H.getError()+" - VALIDATE_STATUS "+H.getProgramParameter(q,H.VALIDATE_STATUS)+`

Material Name: `+f.name+`
Material Type: `+f.type+`

Program Info Log: `+t+`
`+w0+`
`+z0)}else if(t!=="")console.warn("THREE.WebGLProgram: Program Info Log:",t);else if(d===""||e==="")W0=!1;if(W0)f.diagnostics={runnable:g,programLog:t,vertexShader:{log:d,prefix:Y},fragmentShader:{log:e,prefix:N}}}H.deleteShader(h),H.deleteShader(C),y=new D6(H,q),P=bE(H,q)}let y;this.getUniforms=function(){if(y===void 0)z(this);return y};let P;this.getAttributes=function(){if(P===void 0)z(this);return P};let F=Q.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(F===!1)F=H.getProgramParameter(q,_E);return F},this.destroy=function(){M.releaseStatesOfProgram(this),H.deleteProgram(q),this.program=void 0},this.type=Q.shaderType,this.name=Q.shaderName,this.id=AE++,this.cacheKey=J,this.usedTimes=1,this.program=q,this.vertexShader=h,this.fragmentShader=C,this}var iE=0;class OM{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update($){let{vertexShader:J,fragmentShader:Q}=$,M=this._getShaderStage(J),H=this._getShaderStage(Q),K=this._getShaderCacheForMaterial($);if(K.has(M)===!1)K.add(M),M.usedTimes++;if(K.has(H)===!1)K.add(H),H.usedTimes++;return this}remove($){let J=this.materialCache.get($);for(let Q of J)if(Q.usedTimes--,Q.usedTimes===0)this.shaderCache.delete(Q.code);return this.materialCache.delete($),this}getVertexShaderID($){return this._getShaderStage($.vertexShader).id}getFragmentShaderID($){return this._getShaderStage($.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial($){let J=this.materialCache,Q=J.get($);if(Q===void 0)Q=new Set,J.set($,Q);return Q}_getShaderStage($){let J=this.shaderCache,Q=J.get($);if(Q===void 0)Q=new FM($),J.set($,Q);return Q}}class FM{constructor($){this.id=iE++,this.code=$,this.usedTimes=0}}function aE($,J,Q,M,H,K,W){let k=new G$,E=new OM,w=new Set,R=[],Z=H.logarithmicDepthBuffer,U=H.vertexTextures,X=H.precision,G={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function q(P){if(w.add(P),P===0)return"uv";return`uv${P}`}function Y(P,F,f,u,x){let c=u.fog,t=x.geometry,d=P.isMeshStandardMaterial?u.environment:null,e=(P.isMeshStandardMaterial?Q:J).get(P.envMap||d),g=!!e&&e.mapping===H6?e.image.height:null,W0=G[P.type];if(P.precision!==null){if(X=H.getMaxPrecision(P.precision),X!==P.precision)console.warn("THREE.WebGLProgram.getParameters:",P.precision,"not supported, using",X,"instead.")}let w0=t.morphAttributes.position||t.morphAttributes.normal||t.morphAttributes.color,z0=w0!==void 0?w0.length:0,b0=0;if(t.morphAttributes.position!==void 0)b0=1;if(t.morphAttributes.normal!==void 0)b0=2;if(t.morphAttributes.color!==void 0)b0=3;let c0,p,M0,U0;if(W0){let o0=Y5[W0];c0=o0.vertexShader,p=o0.fragmentShader}else c0=P.vertexShader,p=P.fragmentShader,E.update(P),M0=E.getVertexShaderID(P),U0=E.getFragmentShaderID(P);let Z0=$.getRenderTarget(),X0=$.state.buffers.depth.getReversed(),y0=x.isInstancedMesh===!0,T0=x.isBatchedMesh===!0,_0=!!P.map,T=!!P.matcap,l0=!!e,B0=!!P.aoMap,p0=!!P.lightMap,D0=!!P.bumpMap,d0=!!P.normalMap,N0=!!P.displacementMap,q0=!!P.emissiveMap,J1=!!P.metalnessMap,t0=!!P.roughnessMap,W1=P.anisotropy>0,I=P.clearcoat>0,O=P.dispersion>0,b=P.iridescence>0,a=P.sheen>0,J0=P.transmission>0,s=W1&&!!P.anisotropyMap,O0=I&&!!P.clearcoatMap,E0=I&&!!P.clearcoatNormalMap,L0=I&&!!P.clearcoatRoughnessMap,S0=b&&!!P.iridescenceMap,H0=b&&!!P.iridescenceThicknessMap,R0=a&&!!P.sheenColorMap,C0=a&&!!P.sheenRoughnessMap,I0=!!P.specularMap,A=!!P.specularColorMap,n=!!P.specularIntensityMap,_=J0&&!!P.transmissionMap,o=J0&&!!P.thicknessMap,$0=!!P.gradientMap,k0=!!P.alphaMap,Q0=P.alphaTest>0,i=!!P.alphaHash,P0=!!P.extensions,v0=z5;if(P.toneMapped){if(Z0===null||Z0.isXRRenderTarget===!0)v0=$.toneMapping}let s0={shaderID:W0,shaderType:P.type,shaderName:P.name,vertexShader:c0,fragmentShader:p,defines:P.defines,customVertexShaderID:M0,customFragmentShaderID:U0,isRawShaderMaterial:P.isRawShaderMaterial===!0,glslVersion:P.glslVersion,precision:X,batching:T0,batchingColor:T0&&x._colorsTexture!==null,instancing:y0,instancingColor:y0&&x.instanceColor!==null,instancingMorph:y0&&x.morphTexture!==null,supportsVertexTextures:U,outputColorSpace:Z0===null?$.outputColorSpace:Z0.isXRRenderTarget===!0?Z0.texture.colorSpace:w6,alphaToCoverage:!!P.alphaToCoverage,map:_0,matcap:T,envMap:l0,envMapMode:l0&&e.mapping,envMapCubeUVHeight:g,aoMap:B0,lightMap:p0,bumpMap:D0,normalMap:d0,displacementMap:U&&N0,emissiveMap:q0,normalMapObjectSpace:d0&&P.normalMapType===CQ,normalMapTangentSpace:d0&&P.normalMapType===IQ,metalnessMap:J1,roughnessMap:t0,anisotropy:W1,anisotropyMap:s,clearcoat:I,clearcoatMap:O0,clearcoatNormalMap:E0,clearcoatRoughnessMap:L0,dispersion:O,iridescence:b,iridescenceMap:S0,iridescenceThicknessMap:H0,sheen:a,sheenColorMap:R0,sheenRoughnessMap:C0,specularMap:I0,specularColorMap:A,specularIntensityMap:n,transmission:J0,transmissionMap:_,thicknessMap:o,gradientMap:$0,opaque:P.transparent===!1&&P.blending===Q6&&P.alphaToCoverage===!1,alphaMap:k0,alphaTest:Q0,alphaHash:i,combine:P.combine,mapUv:_0&&q(P.map.channel),aoMapUv:B0&&q(P.aoMap.channel),lightMapUv:p0&&q(P.lightMap.channel),bumpMapUv:D0&&q(P.bumpMap.channel),normalMapUv:d0&&q(P.normalMap.channel),displacementMapUv:N0&&q(P.displacementMap.channel),emissiveMapUv:q0&&q(P.emissiveMap.channel),metalnessMapUv:J1&&q(P.metalnessMap.channel),roughnessMapUv:t0&&q(P.roughnessMap.channel),anisotropyMapUv:s&&q(P.anisotropyMap.channel),clearcoatMapUv:O0&&q(P.clearcoatMap.channel),clearcoatNormalMapUv:E0&&q(P.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:L0&&q(P.clearcoatRoughnessMap.channel),iridescenceMapUv:S0&&q(P.iridescenceMap.channel),iridescenceThicknessMapUv:H0&&q(P.iridescenceThicknessMap.channel),sheenColorMapUv:R0&&q(P.sheenColorMap.channel),sheenRoughnessMapUv:C0&&q(P.sheenRoughnessMap.channel),specularMapUv:I0&&q(P.specularMap.channel),specularColorMapUv:A&&q(P.specularColorMap.channel),specularIntensityMapUv:n&&q(P.specularIntensityMap.channel),transmissionMapUv:_&&q(P.transmissionMap.channel),thicknessMapUv:o&&q(P.thicknessMap.channel),alphaMapUv:k0&&q(P.alphaMap.channel),vertexTangents:!!t.attributes.tangent&&(d0||W1),vertexColors:P.vertexColors,vertexAlphas:P.vertexColors===!0&&!!t.attributes.color&&t.attributes.color.itemSize===4,pointsUvs:x.isPoints===!0&&!!t.attributes.uv&&(_0||k0),fog:!!c,useFog:P.fog===!0,fogExp2:!!c&&c.isFogExp2,flatShading:P.flatShading===!0&&P.wireframe===!1,sizeAttenuation:P.sizeAttenuation===!0,logarithmicDepthBuffer:Z,reversedDepthBuffer:X0,skinning:x.isSkinnedMesh===!0,morphTargets:t.morphAttributes.position!==void 0,morphNormals:t.morphAttributes.normal!==void 0,morphColors:t.morphAttributes.color!==void 0,morphTargetsCount:z0,morphTextureStride:b0,numDirLights:F.directional.length,numPointLights:F.point.length,numSpotLights:F.spot.length,numSpotLightMaps:F.spotLightMap.length,numRectAreaLights:F.rectArea.length,numHemiLights:F.hemi.length,numDirLightShadows:F.directionalShadowMap.length,numPointLightShadows:F.pointShadowMap.length,numSpotLightShadows:F.spotShadowMap.length,numSpotLightShadowsWithMaps:F.numSpotLightShadowsWithMaps,numLightProbes:F.numLightProbes,numClippingPlanes:W.numPlanes,numClipIntersection:W.numIntersection,dithering:P.dithering,shadowMapEnabled:$.shadowMap.enabled&&f.length>0,shadowMapType:$.shadowMap.type,toneMapping:v0,decodeVideoTexture:_0&&P.map.isVideoTexture===!0&&i0.getTransfer(P.map.colorSpace)===K1,decodeVideoTextureEmissive:q0&&P.emissiveMap.isVideoTexture===!0&&i0.getTransfer(P.emissiveMap.colorSpace)===K1,premultipliedAlpha:P.premultipliedAlpha,doubleSided:P.side===u1,flipSided:P.side===m1,useDepthPacking:P.depthPacking>=0,depthPacking:P.depthPacking||0,index0AttributeName:P.index0AttributeName,extensionClipCullDistance:P0&&P.extensions.clipCullDistance===!0&&M.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(P0&&P.extensions.multiDraw===!0||T0)&&M.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:M.has("KHR_parallel_shader_compile"),customProgramCacheKey:P.customProgramCacheKey()};return s0.vertexUv1s=w.has(1),s0.vertexUv2s=w.has(2),s0.vertexUv3s=w.has(3),w.clear(),s0}function N(P){let F=[];if(P.shaderID)F.push(P.shaderID);else F.push(P.customVertexShaderID),F.push(P.customFragmentShaderID);if(P.defines!==void 0)for(let f in P.defines)F.push(f),F.push(P.defines[f]);if(P.isRawShaderMaterial===!1)B(F,P),D(F,P),F.push($.outputColorSpace);return F.push(P.customProgramCacheKey),F.join()}function B(P,F){P.push(F.precision),P.push(F.outputColorSpace),P.push(F.envMapMode),P.push(F.envMapCubeUVHeight),P.push(F.mapUv),P.push(F.alphaMapUv),P.push(F.lightMapUv),P.push(F.aoMapUv),P.push(F.bumpMapUv),P.push(F.normalMapUv),P.push(F.displacementMapUv),P.push(F.emissiveMapUv),P.push(F.metalnessMapUv),P.push(F.roughnessMapUv),P.push(F.anisotropyMapUv),P.push(F.clearcoatMapUv),P.push(F.clearcoatNormalMapUv),P.push(F.clearcoatRoughnessMapUv),P.push(F.iridescenceMapUv),P.push(F.iridescenceThicknessMapUv),P.push(F.sheenColorMapUv),P.push(F.sheenRoughnessMapUv),P.push(F.specularMapUv),P.push(F.specularColorMapUv),P.push(F.specularIntensityMapUv),P.push(F.transmissionMapUv),P.push(F.thicknessMapUv),P.push(F.combine),P.push(F.fogExp2),P.push(F.sizeAttenuation),P.push(F.morphTargetsCount),P.push(F.morphAttributeCount),P.push(F.numDirLights),P.push(F.numPointLights),P.push(F.numSpotLights),P.push(F.numSpotLightMaps),P.push(F.numHemiLights),P.push(F.numRectAreaLights),P.push(F.numDirLightShadows),P.push(F.numPointLightShadows),P.push(F.numSpotLightShadows),P.push(F.numSpotLightShadowsWithMaps),P.push(F.numLightProbes),P.push(F.shadowMapType),P.push(F.toneMapping),P.push(F.numClippingPlanes),P.push(F.numClipIntersection),P.push(F.depthPacking)}function D(P,F){if(k.disableAll(),F.supportsVertexTextures)k.enable(0);if(F.instancing)k.enable(1);if(F.instancingColor)k.enable(2);if(F.instancingMorph)k.enable(3);if(F.matcap)k.enable(4);if(F.envMap)k.enable(5);if(F.normalMapObjectSpace)k.enable(6);if(F.normalMapTangentSpace)k.enable(7);if(F.clearcoat)k.enable(8);if(F.iridescence)k.enable(9);if(F.alphaTest)k.enable(10);if(F.vertexColors)k.enable(11);if(F.vertexAlphas)k.enable(12);if(F.vertexUv1s)k.enable(13);if(F.vertexUv2s)k.enable(14);if(F.vertexUv3s)k.enable(15);if(F.vertexTangents)k.enable(16);if(F.anisotropy)k.enable(17);if(F.alphaHash)k.enable(18);if(F.batching)k.enable(19);if(F.dispersion)k.enable(20);if(F.batchingColor)k.enable(21);if(F.gradientMap)k.enable(22);if(P.push(k.mask),k.disableAll(),F.fog)k.enable(0);if(F.useFog)k.enable(1);if(F.flatShading)k.enable(2);if(F.logarithmicDepthBuffer)k.enable(3);if(F.reversedDepthBuffer)k.enable(4);if(F.skinning)k.enable(5);if(F.morphTargets)k.enable(6);if(F.morphNormals)k.enable(7);if(F.morphColors)k.enable(8);if(F.premultipliedAlpha)k.enable(9);if(F.shadowMapEnabled)k.enable(10);if(F.doubleSided)k.enable(11);if(F.flipSided)k.enable(12);if(F.useDepthPacking)k.enable(13);if(F.dithering)k.enable(14);if(F.transmission)k.enable(15);if(F.sheen)k.enable(16);if(F.opaque)k.enable(17);if(F.pointsUvs)k.enable(18);if(F.decodeVideoTexture)k.enable(19);if(F.decodeVideoTextureEmissive)k.enable(20);if(F.alphaToCoverage)k.enable(21);P.push(k.mask)}function V(P){let F=G[P.type],f;if(F){let u=Y5[F];f=xQ.clone(u.uniforms)}else f=P.uniforms;return f}function h(P,F){let f;for(let u=0,x=R.length;u<x;u++){let c=R[u];if(c.cacheKey===F){f=c,++f.usedTimes;break}}if(f===void 0)f=new oE($,F,P,K),R.push(f);return f}function C(P){if(--P.usedTimes===0){let F=R.indexOf(P);R[F]=R[R.length-1],R.pop(),P.destroy()}}function z(P){E.remove(P)}function y(){E.dispose()}return{getParameters:Y,getProgramCacheKey:N,getUniforms:V,acquireProgram:h,releaseProgram:C,releaseShaderCache:z,programs:R,dispose:y}}function rE(){let $=new WeakMap;function J(W){return $.has(W)}function Q(W){let k=$.get(W);if(k===void 0)k={},$.set(W,k);return k}function M(W){$.delete(W)}function H(W,k,E){$.get(W)[k]=E}function K(){$=new WeakMap}return{has:J,get:Q,remove:M,update:H,dispose:K}}function tE($,J){if($.groupOrder!==J.groupOrder)return $.groupOrder-J.groupOrder;else if($.renderOrder!==J.renderOrder)return $.renderOrder-J.renderOrder;else if($.material.id!==J.material.id)return $.material.id-J.material.id;else if($.z!==J.z)return $.z-J.z;else return $.id-J.id}function EM($,J){if($.groupOrder!==J.groupOrder)return $.groupOrder-J.groupOrder;else if($.renderOrder!==J.renderOrder)return $.renderOrder-J.renderOrder;else if($.z!==J.z)return J.z-$.z;else return $.id-J.id}function wM(){let $=[],J=0,Q=[],M=[],H=[];function K(){J=0,Q.length=0,M.length=0,H.length=0}function W(Z,U,X,G,q,Y){let N=$[J];if(N===void 0)N={id:Z.id,object:Z,geometry:U,material:X,groupOrder:G,renderOrder:Z.renderOrder,z:q,group:Y},$[J]=N;else N.id=Z.id,N.object=Z,N.geometry=U,N.material=X,N.groupOrder=G,N.renderOrder=Z.renderOrder,N.z=q,N.group=Y;return J++,N}function k(Z,U,X,G,q,Y){let N=W(Z,U,X,G,q,Y);if(X.transmission>0)M.push(N);else if(X.transparent===!0)H.push(N);else Q.push(N)}function E(Z,U,X,G,q,Y){let N=W(Z,U,X,G,q,Y);if(X.transmission>0)M.unshift(N);else if(X.transparent===!0)H.unshift(N);else Q.unshift(N)}function w(Z,U){if(Q.length>1)Q.sort(Z||tE);if(M.length>1)M.sort(U||EM);if(H.length>1)H.sort(U||EM)}function R(){for(let Z=J,U=$.length;Z<U;Z++){let X=$[Z];if(X.id===null)break;X.id=null,X.object=null,X.geometry=null,X.material=null,X.group=null}}return{opaque:Q,transmissive:M,transparent:H,init:K,push:k,unshift:E,finish:R,sort:w}}function eE(){let $=new WeakMap;function J(M,H){let K=$.get(M),W;if(K===void 0)W=new wM,$.set(M,[W]);else if(H>=K.length)W=new wM,K.push(W);else W=K[H];return W}function Q(){$=new WeakMap}return{get:J,dispose:Q}}function $w(){let $={};return{get:function(J){if($[J.id]!==void 0)return $[J.id];let Q;switch(J.type){case"DirectionalLight":Q={direction:new S,color:new r0};break;case"SpotLight":Q={position:new S,direction:new S,color:new r0,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":Q={position:new S,color:new r0,distance:0,decay:0};break;case"HemisphereLight":Q={direction:new S,skyColor:new r0,groundColor:new r0};break;case"RectAreaLight":Q={color:new r0,position:new S,halfWidth:new S,halfHeight:new S};break}return $[J.id]=Q,Q}}}function Jw(){let $={};return{get:function(J){if($[J.id]!==void 0)return $[J.id];let Q;switch(J.type){case"DirectionalLight":Q={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $1};break;case"SpotLight":Q={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $1};break;case"PointLight":Q={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new $1,shadowCameraNear:1,shadowCameraFar:1000};break}return $[J.id]=Q,Q}}}var Qw=0;function Mw($,J){return(J.castShadow?2:0)-($.castShadow?2:0)+(J.map?1:0)-($.map?1:0)}function Hw($){let J=new $w,Q=Jw(),M={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let w=0;w<9;w++)M.probe.push(new S);let H=new S,K=new M1,W=new M1;function k(w){let R=0,Z=0,U=0;for(let P=0;P<9;P++)M.probe[P].set(0,0,0);let X=0,G=0,q=0,Y=0,N=0,B=0,D=0,V=0,h=0,C=0,z=0;w.sort(Mw);for(let P=0,F=w.length;P<F;P++){let f=w[P],u=f.color,x=f.intensity,c=f.distance,t=f.shadow&&f.shadow.map?f.shadow.map.texture:null;if(f.isAmbientLight)R+=u.r*x,Z+=u.g*x,U+=u.b*x;else if(f.isLightProbe){for(let d=0;d<9;d++)M.probe[d].addScaledVector(f.sh.coefficients[d],x);z++}else if(f.isDirectionalLight){let d=J.get(f);if(d.color.copy(f.color).multiplyScalar(f.intensity),f.castShadow){let e=f.shadow,g=Q.get(f);g.shadowIntensity=e.intensity,g.shadowBias=e.bias,g.shadowNormalBias=e.normalBias,g.shadowRadius=e.radius,g.shadowMapSize=e.mapSize,M.directionalShadow[X]=g,M.directionalShadowMap[X]=t,M.directionalShadowMatrix[X]=f.shadow.matrix,B++}M.directional[X]=d,X++}else if(f.isSpotLight){let d=J.get(f);d.position.setFromMatrixPosition(f.matrixWorld),d.color.copy(u).multiplyScalar(x),d.distance=c,d.coneCos=Math.cos(f.angle),d.penumbraCos=Math.cos(f.angle*(1-f.penumbra)),d.decay=f.decay,M.spot[q]=d;let e=f.shadow;if(f.map){if(M.spotLightMap[h]=f.map,h++,e.updateMatrices(f),f.castShadow)C++}if(M.spotLightMatrix[q]=e.matrix,f.castShadow){let g=Q.get(f);g.shadowIntensity=e.intensity,g.shadowBias=e.bias,g.shadowNormalBias=e.normalBias,g.shadowRadius=e.radius,g.shadowMapSize=e.mapSize,M.spotShadow[q]=g,M.spotShadowMap[q]=t,V++}q++}else if(f.isRectAreaLight){let d=J.get(f);d.color.copy(u).multiplyScalar(x),d.halfWidth.set(f.width*0.5,0,0),d.halfHeight.set(0,f.height*0.5,0),M.rectArea[Y]=d,Y++}else if(f.isPointLight){let d=J.get(f);if(d.color.copy(f.color).multiplyScalar(f.intensity),d.distance=f.distance,d.decay=f.decay,f.castShadow){let e=f.shadow,g=Q.get(f);g.shadowIntensity=e.intensity,g.shadowBias=e.bias,g.shadowNormalBias=e.normalBias,g.shadowRadius=e.radius,g.shadowMapSize=e.mapSize,g.shadowCameraNear=e.camera.near,g.shadowCameraFar=e.camera.far,M.pointShadow[G]=g,M.pointShadowMap[G]=t,M.pointShadowMatrix[G]=f.shadow.matrix,D++}M.point[G]=d,G++}else if(f.isHemisphereLight){let d=J.get(f);d.skyColor.copy(f.color).multiplyScalar(x),d.groundColor.copy(f.groundColor).multiplyScalar(x),M.hemi[N]=d,N++}}if(Y>0)if($.has("OES_texture_float_linear")===!0)M.rectAreaLTC1=Y0.LTC_FLOAT_1,M.rectAreaLTC2=Y0.LTC_FLOAT_2;else M.rectAreaLTC1=Y0.LTC_HALF_1,M.rectAreaLTC2=Y0.LTC_HALF_2;M.ambient[0]=R,M.ambient[1]=Z,M.ambient[2]=U;let y=M.hash;if(y.directionalLength!==X||y.pointLength!==G||y.spotLength!==q||y.rectAreaLength!==Y||y.hemiLength!==N||y.numDirectionalShadows!==B||y.numPointShadows!==D||y.numSpotShadows!==V||y.numSpotMaps!==h||y.numLightProbes!==z)M.directional.length=X,M.spot.length=q,M.rectArea.length=Y,M.point.length=G,M.hemi.length=N,M.directionalShadow.length=B,M.directionalShadowMap.length=B,M.pointShadow.length=D,M.pointShadowMap.length=D,M.spotShadow.length=V,M.spotShadowMap.length=V,M.directionalShadowMatrix.length=B,M.pointShadowMatrix.length=D,M.spotLightMatrix.length=V+h-C,M.spotLightMap.length=h,M.numSpotLightShadowsWithMaps=C,M.numLightProbes=z,y.directionalLength=X,y.pointLength=G,y.spotLength=q,y.rectAreaLength=Y,y.hemiLength=N,y.numDirectionalShadows=B,y.numPointShadows=D,y.numSpotShadows=V,y.numSpotMaps=h,y.numLightProbes=z,M.version=Qw++}function E(w,R){let Z=0,U=0,X=0,G=0,q=0,Y=R.matrixWorldInverse;for(let N=0,B=w.length;N<B;N++){let D=w[N];if(D.isDirectionalLight){let V=M.directional[Z];V.direction.setFromMatrixPosition(D.matrixWorld),H.setFromMatrixPosition(D.target.matrixWorld),V.direction.sub(H),V.direction.transformDirection(Y),Z++}else if(D.isSpotLight){let V=M.spot[X];V.position.setFromMatrixPosition(D.matrixWorld),V.position.applyMatrix4(Y),V.direction.setFromMatrixPosition(D.matrixWorld),H.setFromMatrixPosition(D.target.matrixWorld),V.direction.sub(H),V.direction.transformDirection(Y),X++}else if(D.isRectAreaLight){let V=M.rectArea[G];V.position.setFromMatrixPosition(D.matrixWorld),V.position.applyMatrix4(Y),W.identity(),K.copy(D.matrixWorld),K.premultiply(Y),W.extractRotation(K),V.halfWidth.set(D.width*0.5,0,0),V.halfHeight.set(0,D.height*0.5,0),V.halfWidth.applyMatrix4(W),V.halfHeight.applyMatrix4(W),G++}else if(D.isPointLight){let V=M.point[U];V.position.setFromMatrixPosition(D.matrixWorld),V.position.applyMatrix4(Y),U++}else if(D.isHemisphereLight){let V=M.hemi[q];V.direction.setFromMatrixPosition(D.matrixWorld),V.direction.transformDirection(Y),q++}}}return{setup:k,setupView:E,state:M}}function ZM($){let J=new Hw($),Q=[],M=[];function H(R){w.camera=R,Q.length=0,M.length=0}function K(R){Q.push(R)}function W(R){M.push(R)}function k(){J.setup(Q)}function E(R){J.setupView(Q,R)}let w={lightsArray:Q,shadowsArray:M,camera:null,lights:J,transmissionRenderTarget:{}};return{init:H,state:w,setupLights:k,setupLightsView:E,pushLight:K,pushShadow:W}}function Kw($){let J=new WeakMap;function Q(H,K=0){let W=J.get(H),k;if(W===void 0)k=new ZM($),J.set(H,[k]);else if(K>=W.length)k=new ZM($),W.push(k);else k=W[K];return k}function M(){J=new WeakMap}return{get:Q,dispose:M}}var Ww=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,kw=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Ew($,J,Q){let M=new V$,H=new $1,K=new $1,W=new U1,k=new XJ({depthPacking:BQ}),E=new GJ,w={},R=Q.maxTextureSize,Z={[R5]:m1,[m1]:R5,[u1]:u1},U=new J5({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new $1},radius:{value:4}},vertexShader:Ww,fragmentShader:kw}),X=U.clone();X.defines.HORIZONTAL_PASS=1;let G=new n1;G.setAttribute("position",new N1(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let q=new f1(G,U),Y=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=L9;let N=this.type;this.render=function(C,z,y){if(Y.enabled===!1)return;if(Y.autoUpdate===!1&&Y.needsUpdate===!1)return;if(C.length===0)return;let P=$.getRenderTarget(),F=$.getActiveCubeFace(),f=$.getActiveMipmapLevel(),u=$.state;if(u.setBlending(j5),u.buffers.depth.getReversed())u.buffers.color.setClear(0,0,0,0);else u.buffers.color.setClear(1,1,1,1);u.buffers.depth.setTest(!0),u.setScissorTest(!1);let x=N!==Z5&&this.type===Z5,c=N===Z5&&this.type!==Z5;for(let t=0,d=C.length;t<d;t++){let e=C[t],g=e.shadow;if(g===void 0){console.warn("THREE.WebGLShadowMap:",e,"has no shadow.");continue}if(g.autoUpdate===!1&&g.needsUpdate===!1)continue;H.copy(g.mapSize);let W0=g.getFrameExtents();if(H.multiply(W0),K.copy(g.mapSize),H.x>R||H.y>R){if(H.x>R)K.x=Math.floor(R/W0.x),H.x=K.x*W0.x,g.mapSize.x=K.x;if(H.y>R)K.y=Math.floor(R/W0.y),H.y=K.y*W0.y,g.mapSize.y=K.y}if(g.map===null||x===!0||c===!0){let z0=this.type!==Z5?{minFilter:c1,magFilter:c1}:{};if(g.map!==null)g.map.dispose();g.map=new $5(H.x,H.y,z0),g.map.texture.name=e.name+".shadowMap",g.camera.updateProjectionMatrix()}$.setRenderTarget(g.map),$.clear();let w0=g.getViewportCount();for(let z0=0;z0<w0;z0++){let b0=g.getViewport(z0);W.set(K.x*b0.x,K.y*b0.y,K.x*b0.z,K.y*b0.w),u.viewport(W),g.updateMatrices(e,z0),M=g.getFrustum(),V(z,y,g.camera,e,this.type)}if(g.isPointLightShadow!==!0&&this.type===Z5)B(g,y);g.needsUpdate=!1}N=this.type,Y.needsUpdate=!1,$.setRenderTarget(P,F,f)};function B(C,z){let y=J.update(q);if(U.defines.VSM_SAMPLES!==C.blurSamples)U.defines.VSM_SAMPLES=C.blurSamples,X.defines.VSM_SAMPLES=C.blurSamples,U.needsUpdate=!0,X.needsUpdate=!0;if(C.mapPass===null)C.mapPass=new $5(H.x,H.y);U.uniforms.shadow_pass.value=C.map.texture,U.uniforms.resolution.value=C.mapSize,U.uniforms.radius.value=C.radius,$.setRenderTarget(C.mapPass),$.clear(),$.renderBufferDirect(z,null,y,U,q,null),X.uniforms.shadow_pass.value=C.mapPass.texture,X.uniforms.resolution.value=C.mapSize,X.uniforms.radius.value=C.radius,$.setRenderTarget(C.map),$.clear(),$.renderBufferDirect(z,null,y,X,q,null)}function D(C,z,y,P){let F=null,f=y.isPointLight===!0?C.customDistanceMaterial:C.customDepthMaterial;if(f!==void 0)F=f;else if(F=y.isPointLight===!0?E:k,$.localClippingEnabled&&z.clipShadows===!0&&Array.isArray(z.clippingPlanes)&&z.clippingPlanes.length!==0||z.displacementMap&&z.displacementScale!==0||z.alphaMap&&z.alphaTest>0||z.map&&z.alphaTest>0||z.alphaToCoverage===!0){let u=F.uuid,x=z.uuid,c=w[u];if(c===void 0)c={},w[u]=c;let t=c[x];if(t===void 0)t=F.clone(),c[x]=t,z.addEventListener("dispose",h);F=t}if(F.visible=z.visible,F.wireframe=z.wireframe,P===Z5)F.side=z.shadowSide!==null?z.shadowSide:z.side;else F.side=z.shadowSide!==null?z.shadowSide:Z[z.side];if(F.alphaMap=z.alphaMap,F.alphaTest=z.alphaToCoverage===!0?0.5:z.alphaTest,F.map=z.map,F.clipShadows=z.clipShadows,F.clippingPlanes=z.clippingPlanes,F.clipIntersection=z.clipIntersection,F.displacementMap=z.displacementMap,F.displacementScale=z.displacementScale,F.displacementBias=z.displacementBias,F.wireframeLinewidth=z.wireframeLinewidth,F.linewidth=z.linewidth,y.isPointLight===!0&&F.isMeshDistanceMaterial===!0){let u=$.properties.get(F);u.light=y}return F}function V(C,z,y,P,F){if(C.visible===!1)return;if(C.layers.test(z.layers)&&(C.isMesh||C.isLine||C.isPoints)){if((C.castShadow||C.receiveShadow&&F===Z5)&&(!C.frustumCulled||M.intersectsObject(C))){C.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,C.matrixWorld);let x=J.update(C),c=C.material;if(Array.isArray(c)){let t=x.groups;for(let d=0,e=t.length;d<e;d++){let g=t[d],W0=c[g.materialIndex];if(W0&&W0.visible){let w0=D(C,W0,P,F);C.onBeforeShadow($,C,z,y,x,w0,g),$.renderBufferDirect(y,null,x,w0,C,g),C.onAfterShadow($,C,z,y,x,w0,g)}}}else if(c.visible){let t=D(C,c,P,F);C.onBeforeShadow($,C,z,y,x,t,null),$.renderBufferDirect(y,null,x,t,C,null),C.onAfterShadow($,C,z,y,x,t,null)}}}let u=C.children;for(let x=0,c=u.length;x<c;x++)V(u[x],z,y,P,F)}function h(C){C.target.removeEventListener("dispose",h);for(let y in w){let P=w[y],F=C.target.uuid;if(F in P)P[F].dispose(),delete P[F]}}}var ww={[$$]:J$,[C8]:H$,[Q$]:K$,[M6]:M$,[J$]:$$,[H$]:C8,[K$]:Q$,[M$]:M6};function Zw($,J){function Q(){let _=!1,o=new U1,$0=null,k0=new U1(0,0,0,0);return{setMask:function(Q0){if($0!==Q0&&!_)$.colorMask(Q0,Q0,Q0,Q0),$0=Q0},setLocked:function(Q0){_=Q0},setClear:function(Q0,i,P0,v0,s0){if(s0===!0)Q0*=v0,i*=v0,P0*=v0;if(o.set(Q0,i,P0,v0),k0.equals(o)===!1)$.clearColor(Q0,i,P0,v0),k0.copy(o)},reset:function(){_=!1,$0=null,k0.set(-1,0,0,0)}}}function M(){let _=!1,o=!1,$0=null,k0=null,Q0=null;return{setReversed:function(i){if(o!==i){let P0=J.get("EXT_clip_control");if(i)P0.clipControlEXT(P0.LOWER_LEFT_EXT,P0.ZERO_TO_ONE_EXT);else P0.clipControlEXT(P0.LOWER_LEFT_EXT,P0.NEGATIVE_ONE_TO_ONE_EXT);o=i;let v0=Q0;Q0=null,this.setClear(v0)}},getReversed:function(){return o},setTest:function(i){if(i)Z0($.DEPTH_TEST);else X0($.DEPTH_TEST)},setMask:function(i){if($0!==i&&!_)$.depthMask(i),$0=i},setFunc:function(i){if(o)i=ww[i];if(k0!==i){switch(i){case $$:$.depthFunc($.NEVER);break;case J$:$.depthFunc($.ALWAYS);break;case C8:$.depthFunc($.LESS);break;case M6:$.depthFunc($.LEQUAL);break;case Q$:$.depthFunc($.EQUAL);break;case M$:$.depthFunc($.GEQUAL);break;case H$:$.depthFunc($.GREATER);break;case K$:$.depthFunc($.NOTEQUAL);break;default:$.depthFunc($.LEQUAL)}k0=i}},setLocked:function(i){_=i},setClear:function(i){if(Q0!==i){if(o)i=1-i;$.clearDepth(i),Q0=i}},reset:function(){_=!1,$0=null,k0=null,Q0=null,o=!1}}}function H(){let _=!1,o=null,$0=null,k0=null,Q0=null,i=null,P0=null,v0=null,s0=null;return{setTest:function(o0){if(!_)if(o0)Z0($.STENCIL_TEST);else X0($.STENCIL_TEST)},setMask:function(o0){if(o!==o0&&!_)$.stencilMask(o0),o=o0},setFunc:function(o0,q1,V1){if($0!==o0||k0!==q1||Q0!==V1)$.stencilFunc(o0,q1,V1),$0=o0,k0=q1,Q0=V1},setOp:function(o0,q1,V1){if(i!==o0||P0!==q1||v0!==V1)$.stencilOp(o0,q1,V1),i=o0,P0=q1,v0=V1},setLocked:function(o0){_=o0},setClear:function(o0){if(s0!==o0)$.clearStencil(o0),s0=o0},reset:function(){_=!1,o=null,$0=null,k0=null,Q0=null,i=null,P0=null,v0=null,s0=null}}}let K=new Q,W=new M,k=new H,E=new WeakMap,w=new WeakMap,R={},Z={},U=new WeakMap,X=[],G=null,q=!1,Y=null,N=null,B=null,D=null,V=null,h=null,C=null,z=new r0(0,0,0),y=0,P=!1,F=null,f=null,u=null,x=null,c=null,t=$.getParameter($.MAX_COMBINED_TEXTURE_IMAGE_UNITS),d=!1,e=0,g=$.getParameter($.VERSION);if(g.indexOf("WebGL")!==-1)e=parseFloat(/^WebGL (\d)/.exec(g)[1]),d=e>=1;else if(g.indexOf("OpenGL ES")!==-1)e=parseFloat(/^OpenGL ES (\d)/.exec(g)[1]),d=e>=2;let W0=null,w0={},z0=$.getParameter($.SCISSOR_BOX),b0=$.getParameter($.VIEWPORT),c0=new U1().fromArray(z0),p=new U1().fromArray(b0);function M0(_,o,$0,k0){let Q0=new Uint8Array(4),i=$.createTexture();$.bindTexture(_,i),$.texParameteri(_,$.TEXTURE_MIN_FILTER,$.NEAREST),$.texParameteri(_,$.TEXTURE_MAG_FILTER,$.NEAREST);for(let P0=0;P0<$0;P0++)if(_===$.TEXTURE_3D||_===$.TEXTURE_2D_ARRAY)$.texImage3D(o,0,$.RGBA,1,1,k0,0,$.RGBA,$.UNSIGNED_BYTE,Q0);else $.texImage2D(o+P0,0,$.RGBA,1,1,0,$.RGBA,$.UNSIGNED_BYTE,Q0);return i}let U0={};U0[$.TEXTURE_2D]=M0($.TEXTURE_2D,$.TEXTURE_2D,1),U0[$.TEXTURE_CUBE_MAP]=M0($.TEXTURE_CUBE_MAP,$.TEXTURE_CUBE_MAP_POSITIVE_X,6),U0[$.TEXTURE_2D_ARRAY]=M0($.TEXTURE_2D_ARRAY,$.TEXTURE_2D_ARRAY,1,1),U0[$.TEXTURE_3D]=M0($.TEXTURE_3D,$.TEXTURE_3D,1,1),K.setClear(0,0,0,1),W.setClear(1),k.setClear(0),Z0($.DEPTH_TEST),W.setFunc(M6),D0(!1),d0(F9),Z0($.CULL_FACE),B0(j5);function Z0(_){if(R[_]!==!0)$.enable(_),R[_]=!0}function X0(_){if(R[_]!==!1)$.disable(_),R[_]=!1}function y0(_,o){if(Z[_]!==o){if($.bindFramebuffer(_,o),Z[_]=o,_===$.DRAW_FRAMEBUFFER)Z[$.FRAMEBUFFER]=o;if(_===$.FRAMEBUFFER)Z[$.DRAW_FRAMEBUFFER]=o;return!0}return!1}function T0(_,o){let $0=X,k0=!1;if(_){if($0=U.get(o),$0===void 0)$0=[],U.set(o,$0);let Q0=_.textures;if($0.length!==Q0.length||$0[0]!==$.COLOR_ATTACHMENT0){for(let i=0,P0=Q0.length;i<P0;i++)$0[i]=$.COLOR_ATTACHMENT0+i;$0.length=Q0.length,k0=!0}}else if($0[0]!==$.BACK)$0[0]=$.BACK,k0=!0;if(k0)$.drawBuffers($0)}function _0(_){if(G!==_)return $.useProgram(_),G=_,!0;return!1}let T={[I8]:$.FUNC_ADD,[p7]:$.FUNC_SUBTRACT,[x7]:$.FUNC_REVERSE_SUBTRACT};T[g7]=$.MIN,T[l7]=$.MAX;let l0={[d7]:$.ZERO,[m7]:$.ONE,[u7]:$.SRC_COLOR,[n7]:$.SRC_ALPHA,[t7]:$.SRC_ALPHA_SATURATE,[a7]:$.DST_COLOR,[o7]:$.DST_ALPHA,[c7]:$.ONE_MINUS_SRC_COLOR,[s7]:$.ONE_MINUS_SRC_ALPHA,[r7]:$.ONE_MINUS_DST_COLOR,[i7]:$.ONE_MINUS_DST_ALPHA,[e7]:$.CONSTANT_COLOR,[$Q]:$.ONE_MINUS_CONSTANT_COLOR,[JQ]:$.CONSTANT_ALPHA,[QQ]:$.ONE_MINUS_CONSTANT_ALPHA};function B0(_,o,$0,k0,Q0,i,P0,v0,s0,o0){if(_===j5){if(q===!0)X0($.BLEND),q=!1;return}if(q===!1)Z0($.BLEND),q=!0;if(_!==b7){if(_!==Y||o0!==P){if(N!==I8||V!==I8)$.blendEquation($.FUNC_ADD),N=I8,V=I8;if(o0)switch(_){case Q6:$.blendFuncSeparate($.ONE,$.ONE_MINUS_SRC_ALPHA,$.ONE,$.ONE_MINUS_SRC_ALPHA);break;case P9:$.blendFunc($.ONE,$.ONE);break;case V9:$.blendFuncSeparate($.ZERO,$.ONE_MINUS_SRC_COLOR,$.ZERO,$.ONE);break;case z9:$.blendFuncSeparate($.DST_COLOR,$.ONE_MINUS_SRC_ALPHA,$.ZERO,$.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",_);break}else switch(_){case Q6:$.blendFuncSeparate($.SRC_ALPHA,$.ONE_MINUS_SRC_ALPHA,$.ONE,$.ONE_MINUS_SRC_ALPHA);break;case P9:$.blendFuncSeparate($.SRC_ALPHA,$.ONE,$.ONE,$.ONE);break;case V9:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case z9:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",_);break}B=null,D=null,h=null,C=null,z.set(0,0,0),y=0,Y=_,P=o0}return}if(Q0=Q0||o,i=i||$0,P0=P0||k0,o!==N||Q0!==V)$.blendEquationSeparate(T[o],T[Q0]),N=o,V=Q0;if($0!==B||k0!==D||i!==h||P0!==C)$.blendFuncSeparate(l0[$0],l0[k0],l0[i],l0[P0]),B=$0,D=k0,h=i,C=P0;if(v0.equals(z)===!1||s0!==y)$.blendColor(v0.r,v0.g,v0.b,s0),z.copy(v0),y=s0;Y=_,P=!1}function p0(_,o){_.side===u1?X0($.CULL_FACE):Z0($.CULL_FACE);let $0=_.side===m1;if(o)$0=!$0;D0($0),_.blending===Q6&&_.transparent===!1?B0(j5):B0(_.blending,_.blendEquation,_.blendSrc,_.blendDst,_.blendEquationAlpha,_.blendSrcAlpha,_.blendDstAlpha,_.blendColor,_.blendAlpha,_.premultipliedAlpha),W.setFunc(_.depthFunc),W.setTest(_.depthTest),W.setMask(_.depthWrite),K.setMask(_.colorWrite);let k0=_.stencilWrite;if(k.setTest(k0),k0)k.setMask(_.stencilWriteMask),k.setFunc(_.stencilFunc,_.stencilRef,_.stencilFuncMask),k.setOp(_.stencilFail,_.stencilZFail,_.stencilZPass);q0(_.polygonOffset,_.polygonOffsetFactor,_.polygonOffsetUnits),_.alphaToCoverage===!0?Z0($.SAMPLE_ALPHA_TO_COVERAGE):X0($.SAMPLE_ALPHA_TO_COVERAGE)}function D0(_){if(F!==_){if(_)$.frontFace($.CW);else $.frontFace($.CCW);F=_}}function d0(_){if(_!==j7){if(Z0($.CULL_FACE),_!==f)if(_===F9)$.cullFace($.BACK);else if(_===y7)$.cullFace($.FRONT);else $.cullFace($.FRONT_AND_BACK)}else X0($.CULL_FACE);f=_}function N0(_){if(_!==u){if(d)$.lineWidth(_);u=_}}function q0(_,o,$0){if(_){if(Z0($.POLYGON_OFFSET_FILL),x!==o||c!==$0)$.polygonOffset(o,$0),x=o,c=$0}else X0($.POLYGON_OFFSET_FILL)}function J1(_){if(_)Z0($.SCISSOR_TEST);else X0($.SCISSOR_TEST)}function t0(_){if(_===void 0)_=$.TEXTURE0+t-1;if(W0!==_)$.activeTexture(_),W0=_}function W1(_,o,$0){if($0===void 0)if(W0===null)$0=$.TEXTURE0+t-1;else $0=W0;let k0=w0[$0];if(k0===void 0)k0={type:void 0,texture:void 0},w0[$0]=k0;if(k0.type!==_||k0.texture!==o){if(W0!==$0)$.activeTexture($0),W0=$0;$.bindTexture(_,o||U0[_]),k0.type=_,k0.texture=o}}function I(){let _=w0[W0];if(_!==void 0&&_.type!==void 0)$.bindTexture(_.type,null),_.type=void 0,_.texture=void 0}function O(){try{$.compressedTexImage2D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function b(){try{$.compressedTexImage3D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function a(){try{$.texSubImage2D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function J0(){try{$.texSubImage3D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function s(){try{$.compressedTexSubImage2D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function O0(){try{$.compressedTexSubImage3D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function E0(){try{$.texStorage2D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function L0(){try{$.texStorage3D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function S0(){try{$.texImage2D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function H0(){try{$.texImage3D(...arguments)}catch(_){console.error("THREE.WebGLState:",_)}}function R0(_){if(c0.equals(_)===!1)$.scissor(_.x,_.y,_.z,_.w),c0.copy(_)}function C0(_){if(p.equals(_)===!1)$.viewport(_.x,_.y,_.z,_.w),p.copy(_)}function I0(_,o){let $0=w.get(o);if($0===void 0)$0=new WeakMap,w.set(o,$0);let k0=$0.get(_);if(k0===void 0)k0=$.getUniformBlockIndex(o,_.name),$0.set(_,k0)}function A(_,o){let k0=w.get(o).get(_);if(E.get(o)!==k0)$.uniformBlockBinding(o,k0,_.__bindingPointIndex),E.set(o,k0)}function n(){$.disable($.BLEND),$.disable($.CULL_FACE),$.disable($.DEPTH_TEST),$.disable($.POLYGON_OFFSET_FILL),$.disable($.SCISSOR_TEST),$.disable($.STENCIL_TEST),$.disable($.SAMPLE_ALPHA_TO_COVERAGE),$.blendEquation($.FUNC_ADD),$.blendFunc($.ONE,$.ZERO),$.blendFuncSeparate($.ONE,$.ZERO,$.ONE,$.ZERO),$.blendColor(0,0,0,0),$.colorMask(!0,!0,!0,!0),$.clearColor(0,0,0,0),$.depthMask(!0),$.depthFunc($.LESS),W.setReversed(!1),$.clearDepth(1),$.stencilMask(4294967295),$.stencilFunc($.ALWAYS,0,4294967295),$.stencilOp($.KEEP,$.KEEP,$.KEEP),$.clearStencil(0),$.cullFace($.BACK),$.frontFace($.CCW),$.polygonOffset(0,0),$.activeTexture($.TEXTURE0),$.bindFramebuffer($.FRAMEBUFFER,null),$.bindFramebuffer($.DRAW_FRAMEBUFFER,null),$.bindFramebuffer($.READ_FRAMEBUFFER,null),$.useProgram(null),$.lineWidth(1),$.scissor(0,0,$.canvas.width,$.canvas.height),$.viewport(0,0,$.canvas.width,$.canvas.height),R={},W0=null,w0={},Z={},U=new WeakMap,X=[],G=null,q=!1,Y=null,N=null,B=null,D=null,V=null,h=null,C=null,z=new r0(0,0,0),y=0,P=!1,F=null,f=null,u=null,x=null,c=null,c0.set(0,0,$.canvas.width,$.canvas.height),p.set(0,0,$.canvas.width,$.canvas.height),K.reset(),W.reset(),k.reset()}return{buffers:{color:K,depth:W,stencil:k},enable:Z0,disable:X0,bindFramebuffer:y0,drawBuffers:T0,useProgram:_0,setBlending:B0,setMaterial:p0,setFlipSided:D0,setCullFace:d0,setLineWidth:N0,setPolygonOffset:q0,setScissorTest:J1,activeTexture:t0,bindTexture:W1,unbindTexture:I,compressedTexImage2D:O,compressedTexImage3D:b,texImage2D:S0,texImage3D:H0,updateUBOMapping:I0,uniformBlockBinding:A,texStorage2D:E0,texStorage3D:L0,texSubImage2D:a,texSubImage3D:J0,compressedTexSubImage2D:s,compressedTexSubImage3D:O0,scissor:R0,viewport:C0,reset:n}}function Rw($,J,Q,M,H,K,W){let k=J.has("WEBGL_multisampled_render_to_texture")?J.get("WEBGL_multisampled_render_to_texture"):null,E=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),w=new $1,R=new WeakMap,Z,U=new WeakMap,X=!1;try{X=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(I){}function G(I,O){return X?new OffscreenCanvas(I,O):J6("canvas")}function q(I,O,b){let a=1,J0=W1(I);if(J0.width>b||J0.height>b)a=b/Math.max(J0.width,J0.height);if(a<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){let s=Math.floor(a*J0.width),O0=Math.floor(a*J0.height);if(Z===void 0)Z=G(s,O0);let E0=O?G(s,O0):Z;return E0.width=s,E0.height=O0,E0.getContext("2d").drawImage(I,0,0,s,O0),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+J0.width+"x"+J0.height+") to ("+s+"x"+O0+")."),E0}else{if("data"in I)console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+J0.width+"x"+J0.height+").");return I}return I}function Y(I){return I.generateMipmaps}function N(I){$.generateMipmap(I)}function B(I){if(I.isWebGLCubeRenderTarget)return $.TEXTURE_CUBE_MAP;if(I.isWebGL3DRenderTarget)return $.TEXTURE_3D;if(I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture)return $.TEXTURE_2D_ARRAY;return $.TEXTURE_2D}function D(I,O,b,a,J0=!1){if(I!==null){if($[I]!==void 0)return $[I];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let s=O;if(O===$.RED){if(b===$.FLOAT)s=$.R32F;if(b===$.HALF_FLOAT)s=$.R16F;if(b===$.UNSIGNED_BYTE)s=$.R8}if(O===$.RED_INTEGER){if(b===$.UNSIGNED_BYTE)s=$.R8UI;if(b===$.UNSIGNED_SHORT)s=$.R16UI;if(b===$.UNSIGNED_INT)s=$.R32UI;if(b===$.BYTE)s=$.R8I;if(b===$.SHORT)s=$.R16I;if(b===$.INT)s=$.R32I}if(O===$.RG){if(b===$.FLOAT)s=$.RG32F;if(b===$.HALF_FLOAT)s=$.RG16F;if(b===$.UNSIGNED_BYTE)s=$.RG8}if(O===$.RG_INTEGER){if(b===$.UNSIGNED_BYTE)s=$.RG8UI;if(b===$.UNSIGNED_SHORT)s=$.RG16UI;if(b===$.UNSIGNED_INT)s=$.RG32UI;if(b===$.BYTE)s=$.RG8I;if(b===$.SHORT)s=$.RG16I;if(b===$.INT)s=$.RG32I}if(O===$.RGB_INTEGER){if(b===$.UNSIGNED_BYTE)s=$.RGB8UI;if(b===$.UNSIGNED_SHORT)s=$.RGB16UI;if(b===$.UNSIGNED_INT)s=$.RGB32UI;if(b===$.BYTE)s=$.RGB8I;if(b===$.SHORT)s=$.RGB16I;if(b===$.INT)s=$.RGB32I}if(O===$.RGBA_INTEGER){if(b===$.UNSIGNED_BYTE)s=$.RGBA8UI;if(b===$.UNSIGNED_SHORT)s=$.RGBA16UI;if(b===$.UNSIGNED_INT)s=$.RGBA32UI;if(b===$.BYTE)s=$.RGBA8I;if(b===$.SHORT)s=$.RGBA16I;if(b===$.INT)s=$.RGBA32I}if(O===$.RGB){if(b===$.UNSIGNED_INT_5_9_9_9_REV)s=$.RGB9_E5}if(O===$.RGBA){let O0=J0?MJ:i0.getTransfer(a);if(b===$.FLOAT)s=$.RGBA32F;if(b===$.HALF_FLOAT)s=$.RGBA16F;if(b===$.UNSIGNED_BYTE)s=O0===K1?$.SRGB8_ALPHA8:$.RGBA8;if(b===$.UNSIGNED_SHORT_4_4_4_4)s=$.RGBA4;if(b===$.UNSIGNED_SHORT_5_5_5_1)s=$.RGB5_A1}if(s===$.R16F||s===$.R32F||s===$.RG16F||s===$.RG32F||s===$.RGBA16F||s===$.RGBA32F)J.get("EXT_color_buffer_float");return s}function V(I,O){let b;if(I){if(O===null||O===S8||O===T8)b=$.DEPTH24_STENCIL8;else if(O===y5)b=$.DEPTH32F_STENCIL8;else if(O===W6)b=$.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(O===null||O===S8||O===T8)b=$.DEPTH_COMPONENT24;else if(O===y5)b=$.DEPTH_COMPONENT32F;else if(O===W6)b=$.DEPTH_COMPONENT16;return b}function h(I,O){if(Y(I)===!0||I.isFramebufferTexture&&I.minFilter!==c1&&I.minFilter!==a5)return Math.log2(Math.max(O.width,O.height))+1;else if(I.mipmaps!==void 0&&I.mipmaps.length>0)return I.mipmaps.length;else if(I.isCompressedTexture&&Array.isArray(I.image))return O.mipmaps.length;else return 1}function C(I){let O=I.target;if(O.removeEventListener("dispose",C),y(O),O.isVideoTexture)R.delete(O)}function z(I){let O=I.target;O.removeEventListener("dispose",z),F(O)}function y(I){let O=M.get(I);if(O.__webglInit===void 0)return;let b=I.source,a=U.get(b);if(a){let J0=a[O.__cacheKey];if(J0.usedTimes--,J0.usedTimes===0)P(I);if(Object.keys(a).length===0)U.delete(b)}M.remove(I)}function P(I){let O=M.get(I);$.deleteTexture(O.__webglTexture);let b=I.source,a=U.get(b);delete a[O.__cacheKey],W.memory.textures--}function F(I){let O=M.get(I);if(I.depthTexture)I.depthTexture.dispose(),M.remove(I.depthTexture);if(I.isWebGLCubeRenderTarget)for(let a=0;a<6;a++){if(Array.isArray(O.__webglFramebuffer[a]))for(let J0=0;J0<O.__webglFramebuffer[a].length;J0++)$.deleteFramebuffer(O.__webglFramebuffer[a][J0]);else $.deleteFramebuffer(O.__webglFramebuffer[a]);if(O.__webglDepthbuffer)$.deleteRenderbuffer(O.__webglDepthbuffer[a])}else{if(Array.isArray(O.__webglFramebuffer))for(let a=0;a<O.__webglFramebuffer.length;a++)$.deleteFramebuffer(O.__webglFramebuffer[a]);else $.deleteFramebuffer(O.__webglFramebuffer);if(O.__webglDepthbuffer)$.deleteRenderbuffer(O.__webglDepthbuffer);if(O.__webglMultisampledFramebuffer)$.deleteFramebuffer(O.__webglMultisampledFramebuffer);if(O.__webglColorRenderbuffer){for(let a=0;a<O.__webglColorRenderbuffer.length;a++)if(O.__webglColorRenderbuffer[a])$.deleteRenderbuffer(O.__webglColorRenderbuffer[a])}if(O.__webglDepthRenderbuffer)$.deleteRenderbuffer(O.__webglDepthRenderbuffer)}let b=I.textures;for(let a=0,J0=b.length;a<J0;a++){let s=M.get(b[a]);if(s.__webglTexture)$.deleteTexture(s.__webglTexture),W.memory.textures--;M.remove(b[a])}M.remove(I)}let f=0;function u(){f=0}function x(){let I=f;if(I>=H.maxTextures)console.warn("THREE.WebGLTextures: Trying to use "+I+" texture units while this GPU supports only "+H.maxTextures);return f+=1,I}function c(I){let O=[];return O.push(I.wrapS),O.push(I.wrapT),O.push(I.wrapR||0),O.push(I.magFilter),O.push(I.minFilter),O.push(I.anisotropy),O.push(I.internalFormat),O.push(I.format),O.push(I.type),O.push(I.generateMipmaps),O.push(I.premultiplyAlpha),O.push(I.flipY),O.push(I.unpackAlignment),O.push(I.colorSpace),O.join()}function t(I,O){let b=M.get(I);if(I.isVideoTexture)J1(I);if(I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&b.__version!==I.version){let a=I.image;if(a===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(a.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{U0(b,I,O);return}}else if(I.isExternalTexture)b.__webglTexture=I.sourceTexture?I.sourceTexture:null;Q.bindTexture($.TEXTURE_2D,b.__webglTexture,$.TEXTURE0+O)}function d(I,O){let b=M.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&b.__version!==I.version){U0(b,I,O);return}Q.bindTexture($.TEXTURE_2D_ARRAY,b.__webglTexture,$.TEXTURE0+O)}function e(I,O){let b=M.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&b.__version!==I.version){U0(b,I,O);return}Q.bindTexture($.TEXTURE_3D,b.__webglTexture,$.TEXTURE0+O)}function g(I,O){let b=M.get(I);if(I.version>0&&b.__version!==I.version){Z0(b,I,O);return}Q.bindTexture($.TEXTURE_CUBE_MAP,b.__webglTexture,$.TEXTURE0+O)}let W0={[YQ]:$.REPEAT,[NQ]:$.CLAMP_TO_EDGE,[XQ]:$.MIRRORED_REPEAT},w0={[c1]:$.NEAREST,[GQ]:$.NEAREST_MIPMAP_NEAREST,[K6]:$.NEAREST_MIPMAP_LINEAR,[a5]:$.LINEAR,[E$]:$.LINEAR_MIPMAP_NEAREST,[A8]:$.LINEAR_MIPMAP_LINEAR},z0={[AQ]:$.NEVER,[yQ]:$.ALWAYS,[SQ]:$.LESS,[HJ]:$.LEQUAL,[TQ]:$.EQUAL,[jQ]:$.GEQUAL,[hQ]:$.GREATER,[fQ]:$.NOTEQUAL};function b0(I,O){if(O.type===y5&&J.has("OES_texture_float_linear")===!1&&(O.magFilter===a5||O.magFilter===E$||O.magFilter===K6||O.magFilter===A8||O.minFilter===a5||O.minFilter===E$||O.minFilter===K6||O.minFilter===A8))console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if($.texParameteri(I,$.TEXTURE_WRAP_S,W0[O.wrapS]),$.texParameteri(I,$.TEXTURE_WRAP_T,W0[O.wrapT]),I===$.TEXTURE_3D||I===$.TEXTURE_2D_ARRAY)$.texParameteri(I,$.TEXTURE_WRAP_R,W0[O.wrapR]);if($.texParameteri(I,$.TEXTURE_MAG_FILTER,w0[O.magFilter]),$.texParameteri(I,$.TEXTURE_MIN_FILTER,w0[O.minFilter]),O.compareFunction)$.texParameteri(I,$.TEXTURE_COMPARE_MODE,$.COMPARE_REF_TO_TEXTURE),$.texParameteri(I,$.TEXTURE_COMPARE_FUNC,z0[O.compareFunction]);if(J.has("EXT_texture_filter_anisotropic")===!0){if(O.magFilter===c1)return;if(O.minFilter!==K6&&O.minFilter!==A8)return;if(O.type===y5&&J.has("OES_texture_float_linear")===!1)return;if(O.anisotropy>1||M.get(O).__currentAnisotropy){let b=J.get("EXT_texture_filter_anisotropic");$.texParameterf(I,b.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(O.anisotropy,H.getMaxAnisotropy())),M.get(O).__currentAnisotropy=O.anisotropy}}}function c0(I,O){let b=!1;if(I.__webglInit===void 0)I.__webglInit=!0,O.addEventListener("dispose",C);let a=O.source,J0=U.get(a);if(J0===void 0)J0={},U.set(a,J0);let s=c(O);if(s!==I.__cacheKey){if(J0[s]===void 0)J0[s]={texture:$.createTexture(),usedTimes:0},W.memory.textures++,b=!0;J0[s].usedTimes++;let O0=J0[I.__cacheKey];if(O0!==void 0){if(J0[I.__cacheKey].usedTimes--,O0.usedTimes===0)P(O)}I.__cacheKey=s,I.__webglTexture=J0[s].texture}return b}function p(I,O,b){return Math.floor(Math.floor(I/b)/O)}function M0(I,O,b,a){let s=I.updateRanges;if(s.length===0)Q.texSubImage2D($.TEXTURE_2D,0,0,0,O.width,O.height,b,a,O.data);else{s.sort((H0,R0)=>H0.start-R0.start);let O0=0;for(let H0=1;H0<s.length;H0++){let R0=s[O0],C0=s[H0],I0=R0.start+R0.count,A=p(C0.start,O.width,4),n=p(R0.start,O.width,4);if(C0.start<=I0+1&&A===n&&p(C0.start+C0.count-1,O.width,4)===A)R0.count=Math.max(R0.count,C0.start+C0.count-R0.start);else++O0,s[O0]=C0}s.length=O0+1;let E0=$.getParameter($.UNPACK_ROW_LENGTH),L0=$.getParameter($.UNPACK_SKIP_PIXELS),S0=$.getParameter($.UNPACK_SKIP_ROWS);$.pixelStorei($.UNPACK_ROW_LENGTH,O.width);for(let H0=0,R0=s.length;H0<R0;H0++){let C0=s[H0],I0=Math.floor(C0.start/4),A=Math.ceil(C0.count/4),n=I0%O.width,_=Math.floor(I0/O.width),o=A,$0=1;$.pixelStorei($.UNPACK_SKIP_PIXELS,n),$.pixelStorei($.UNPACK_SKIP_ROWS,_),Q.texSubImage2D($.TEXTURE_2D,0,n,_,o,1,b,a,O.data)}I.clearUpdateRanges(),$.pixelStorei($.UNPACK_ROW_LENGTH,E0),$.pixelStorei($.UNPACK_SKIP_PIXELS,L0),$.pixelStorei($.UNPACK_SKIP_ROWS,S0)}}function U0(I,O,b){let a=$.TEXTURE_2D;if(O.isDataArrayTexture||O.isCompressedArrayTexture)a=$.TEXTURE_2D_ARRAY;if(O.isData3DTexture)a=$.TEXTURE_3D;let J0=c0(I,O),s=O.source;Q.bindTexture(a,I.__webglTexture,$.TEXTURE0+b);let O0=M.get(s);if(s.version!==O0.__version||J0===!0){Q.activeTexture($.TEXTURE0+b);let E0=i0.getPrimaries(i0.workingColorSpace),L0=O.colorSpace===r5?null:i0.getPrimaries(O.colorSpace),S0=O.colorSpace===r5||E0===L0?$.NONE:$.BROWSER_DEFAULT_WEBGL;$.pixelStorei($.UNPACK_FLIP_Y_WEBGL,O.flipY),$.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),$.pixelStorei($.UNPACK_ALIGNMENT,O.unpackAlignment),$.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL,S0);let H0=q(O.image,!1,H.maxTextureSize);H0=t0(O,H0);let R0=K.convert(O.format,O.colorSpace),C0=K.convert(O.type),I0=D(O.internalFormat,R0,C0,O.colorSpace,O.isVideoTexture);b0(a,O);let A,n=O.mipmaps,_=O.isVideoTexture!==!0,o=O0.__version===void 0||J0===!0,$0=s.dataReady,k0=h(O,H0);if(O.isDepthTexture){if(I0=V(O.format===E6,O.type),o)if(_)Q.texStorage2D($.TEXTURE_2D,1,I0,H0.width,H0.height);else Q.texImage2D($.TEXTURE_2D,0,I0,H0.width,H0.height,0,R0,C0,null)}else if(O.isDataTexture)if(n.length>0){if(_&&o)Q.texStorage2D($.TEXTURE_2D,k0,I0,n[0].width,n[0].height);for(let Q0=0,i=n.length;Q0<i;Q0++)if(A=n[Q0],_){if($0)Q.texSubImage2D($.TEXTURE_2D,Q0,0,0,A.width,A.height,R0,C0,A.data)}else Q.texImage2D($.TEXTURE_2D,Q0,I0,A.width,A.height,0,R0,C0,A.data);O.generateMipmaps=!1}else if(_){if(o)Q.texStorage2D($.TEXTURE_2D,k0,I0,H0.width,H0.height);if($0)M0(O,H0,R0,C0)}else Q.texImage2D($.TEXTURE_2D,0,I0,H0.width,H0.height,0,R0,C0,H0.data);else if(O.isCompressedTexture)if(O.isCompressedArrayTexture){if(_&&o)Q.texStorage3D($.TEXTURE_2D_ARRAY,k0,I0,n[0].width,n[0].height,H0.depth);for(let Q0=0,i=n.length;Q0<i;Q0++)if(A=n[Q0],O.format!==e1)if(R0!==null)if(_){if($0)if(O.layerUpdates.size>0){let P0=AJ(A.width,A.height,O.format,O.type);for(let v0 of O.layerUpdates){let s0=A.data.subarray(v0*P0/A.data.BYTES_PER_ELEMENT,(v0+1)*P0/A.data.BYTES_PER_ELEMENT);Q.compressedTexSubImage3D($.TEXTURE_2D_ARRAY,Q0,0,0,v0,A.width,A.height,1,R0,s0)}O.clearLayerUpdates()}else Q.compressedTexSubImage3D($.TEXTURE_2D_ARRAY,Q0,0,0,0,A.width,A.height,H0.depth,R0,A.data)}else Q.compressedTexImage3D($.TEXTURE_2D_ARRAY,Q0,I0,A.width,A.height,H0.depth,0,A.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(_){if($0)Q.texSubImage3D($.TEXTURE_2D_ARRAY,Q0,0,0,0,A.width,A.height,H0.depth,R0,C0,A.data)}else Q.texImage3D($.TEXTURE_2D_ARRAY,Q0,I0,A.width,A.height,H0.depth,0,R0,C0,A.data)}else{if(_&&o)Q.texStorage2D($.TEXTURE_2D,k0,I0,n[0].width,n[0].height);for(let Q0=0,i=n.length;Q0<i;Q0++)if(A=n[Q0],O.format!==e1)if(R0!==null)if(_){if($0)Q.compressedTexSubImage2D($.TEXTURE_2D,Q0,0,0,A.width,A.height,R0,A.data)}else Q.compressedTexImage2D($.TEXTURE_2D,Q0,I0,A.width,A.height,0,A.data);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(_){if($0)Q.texSubImage2D($.TEXTURE_2D,Q0,0,0,A.width,A.height,R0,C0,A.data)}else Q.texImage2D($.TEXTURE_2D,Q0,I0,A.width,A.height,0,R0,C0,A.data)}else if(O.isDataArrayTexture)if(_){if(o)Q.texStorage3D($.TEXTURE_2D_ARRAY,k0,I0,H0.width,H0.height,H0.depth);if($0)if(O.layerUpdates.size>0){let Q0=AJ(H0.width,H0.height,O.format,O.type);for(let i of O.layerUpdates){let P0=H0.data.subarray(i*Q0/H0.data.BYTES_PER_ELEMENT,(i+1)*Q0/H0.data.BYTES_PER_ELEMENT);Q.texSubImage3D($.TEXTURE_2D_ARRAY,0,0,0,i,H0.width,H0.height,1,R0,C0,P0)}O.clearLayerUpdates()}else Q.texSubImage3D($.TEXTURE_2D_ARRAY,0,0,0,0,H0.width,H0.height,H0.depth,R0,C0,H0.data)}else Q.texImage3D($.TEXTURE_2D_ARRAY,0,I0,H0.width,H0.height,H0.depth,0,R0,C0,H0.data);else if(O.isData3DTexture)if(_){if(o)Q.texStorage3D($.TEXTURE_3D,k0,I0,H0.width,H0.height,H0.depth);if($0)Q.texSubImage3D($.TEXTURE_3D,0,0,0,0,H0.width,H0.height,H0.depth,R0,C0,H0.data)}else Q.texImage3D($.TEXTURE_3D,0,I0,H0.width,H0.height,H0.depth,0,R0,C0,H0.data);else if(O.isFramebufferTexture){if(o)if(_)Q.texStorage2D($.TEXTURE_2D,k0,I0,H0.width,H0.height);else{let{width:Q0,height:i}=H0;for(let P0=0;P0<k0;P0++)Q.texImage2D($.TEXTURE_2D,P0,I0,Q0,i,0,R0,C0,null),Q0>>=1,i>>=1}}else if(n.length>0){if(_&&o){let Q0=W1(n[0]);Q.texStorage2D($.TEXTURE_2D,k0,I0,Q0.width,Q0.height)}for(let Q0=0,i=n.length;Q0<i;Q0++)if(A=n[Q0],_){if($0)Q.texSubImage2D($.TEXTURE_2D,Q0,0,0,R0,C0,A)}else Q.texImage2D($.TEXTURE_2D,Q0,I0,R0,C0,A);O.generateMipmaps=!1}else if(_){if(o){let Q0=W1(H0);Q.texStorage2D($.TEXTURE_2D,k0,I0,Q0.width,Q0.height)}if($0)Q.texSubImage2D($.TEXTURE_2D,0,0,0,R0,C0,H0)}else Q.texImage2D($.TEXTURE_2D,0,I0,R0,C0,H0);if(Y(O))N(a);if(O0.__version=s.version,O.onUpdate)O.onUpdate(O)}I.__version=O.version}function Z0(I,O,b){if(O.image.length!==6)return;let a=c0(I,O),J0=O.source;Q.bindTexture($.TEXTURE_CUBE_MAP,I.__webglTexture,$.TEXTURE0+b);let s=M.get(J0);if(J0.version!==s.__version||a===!0){Q.activeTexture($.TEXTURE0+b);let O0=i0.getPrimaries(i0.workingColorSpace),E0=O.colorSpace===r5?null:i0.getPrimaries(O.colorSpace),L0=O.colorSpace===r5||O0===E0?$.NONE:$.BROWSER_DEFAULT_WEBGL;$.pixelStorei($.UNPACK_FLIP_Y_WEBGL,O.flipY),$.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL,O.premultiplyAlpha),$.pixelStorei($.UNPACK_ALIGNMENT,O.unpackAlignment),$.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL,L0);let S0=O.isCompressedTexture||O.image[0].isCompressedTexture,H0=O.image[0]&&O.image[0].isDataTexture,R0=[];for(let i=0;i<6;i++){if(!S0&&!H0)R0[i]=q(O.image[i],!0,H.maxCubemapSize);else R0[i]=H0?O.image[i].image:O.image[i];R0[i]=t0(O,R0[i])}let C0=R0[0],I0=K.convert(O.format,O.colorSpace),A=K.convert(O.type),n=D(O.internalFormat,I0,A,O.colorSpace),_=O.isVideoTexture!==!0,o=s.__version===void 0||a===!0,$0=J0.dataReady,k0=h(O,C0);b0($.TEXTURE_CUBE_MAP,O);let Q0;if(S0){if(_&&o)Q.texStorage2D($.TEXTURE_CUBE_MAP,k0,n,C0.width,C0.height);for(let i=0;i<6;i++){Q0=R0[i].mipmaps;for(let P0=0;P0<Q0.length;P0++){let v0=Q0[P0];if(O.format!==e1)if(I0!==null)if(_){if($0)Q.compressedTexSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0,0,0,v0.width,v0.height,I0,v0.data)}else Q.compressedTexImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0,n,v0.width,v0.height,0,v0.data);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(_){if($0)Q.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0,0,0,v0.width,v0.height,I0,A,v0.data)}else Q.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0,n,v0.width,v0.height,0,I0,A,v0.data)}}}else{if(Q0=O.mipmaps,_&&o){if(Q0.length>0)k0++;let i=W1(R0[0]);Q.texStorage2D($.TEXTURE_CUBE_MAP,k0,n,i.width,i.height)}for(let i=0;i<6;i++)if(H0){if(_){if($0)Q.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,0,0,R0[i].width,R0[i].height,I0,A,R0[i].data)}else Q.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,n,R0[i].width,R0[i].height,0,I0,A,R0[i].data);for(let P0=0;P0<Q0.length;P0++){let s0=Q0[P0].image[i].image;if(_){if($0)Q.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0+1,0,0,s0.width,s0.height,I0,A,s0.data)}else Q.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0+1,n,s0.width,s0.height,0,I0,A,s0.data)}}else{if(_){if($0)Q.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,0,0,I0,A,R0[i])}else Q.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,n,I0,A,R0[i]);for(let P0=0;P0<Q0.length;P0++){let v0=Q0[P0];if(_){if($0)Q.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0+1,0,0,I0,A,v0.image[i])}else Q.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+i,P0+1,n,I0,A,v0.image[i])}}}if(Y(O))N($.TEXTURE_CUBE_MAP);if(s.__version=J0.version,O.onUpdate)O.onUpdate(O)}I.__version=O.version}function X0(I,O,b,a,J0,s){let O0=K.convert(b.format,b.colorSpace),E0=K.convert(b.type),L0=D(b.internalFormat,O0,E0,b.colorSpace),S0=M.get(O),H0=M.get(b);if(H0.__renderTarget=O,!S0.__hasExternalTextures){let R0=Math.max(1,O.width>>s),C0=Math.max(1,O.height>>s);if(J0===$.TEXTURE_3D||J0===$.TEXTURE_2D_ARRAY)Q.texImage3D(J0,s,L0,R0,C0,O.depth,0,O0,E0,null);else Q.texImage2D(J0,s,L0,R0,C0,0,O0,E0,null)}if(Q.bindFramebuffer($.FRAMEBUFFER,I),q0(O))k.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER,a,J0,H0.__webglTexture,0,N0(O));else if(J0===$.TEXTURE_2D||J0>=$.TEXTURE_CUBE_MAP_POSITIVE_X&&J0<=$.TEXTURE_CUBE_MAP_NEGATIVE_Z)$.framebufferTexture2D($.FRAMEBUFFER,a,J0,H0.__webglTexture,s);Q.bindFramebuffer($.FRAMEBUFFER,null)}function y0(I,O,b){if($.bindRenderbuffer($.RENDERBUFFER,I),O.depthBuffer){let a=O.depthTexture,J0=a&&a.isDepthTexture?a.type:null,s=V(O.stencilBuffer,J0),O0=O.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,E0=N0(O);if(q0(O))k.renderbufferStorageMultisampleEXT($.RENDERBUFFER,E0,s,O.width,O.height);else if(b)$.renderbufferStorageMultisample($.RENDERBUFFER,E0,s,O.width,O.height);else $.renderbufferStorage($.RENDERBUFFER,s,O.width,O.height);$.framebufferRenderbuffer($.FRAMEBUFFER,O0,$.RENDERBUFFER,I)}else{let a=O.textures;for(let J0=0;J0<a.length;J0++){let s=a[J0],O0=K.convert(s.format,s.colorSpace),E0=K.convert(s.type),L0=D(s.internalFormat,O0,E0,s.colorSpace),S0=N0(O);if(b&&q0(O)===!1)$.renderbufferStorageMultisample($.RENDERBUFFER,S0,L0,O.width,O.height);else if(q0(O))k.renderbufferStorageMultisampleEXT($.RENDERBUFFER,S0,L0,O.width,O.height);else $.renderbufferStorage($.RENDERBUFFER,L0,O.width,O.height)}}$.bindRenderbuffer($.RENDERBUFFER,null)}function T0(I,O){if(O&&O.isWebGLCubeRenderTarget)throw Error("Depth Texture with cube render targets is not supported");if(Q.bindFramebuffer($.FRAMEBUFFER,I),!(O.depthTexture&&O.depthTexture.isDepthTexture))throw Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let a=M.get(O.depthTexture);if(a.__renderTarget=O,!a.__webglTexture||O.depthTexture.image.width!==O.width||O.depthTexture.image.height!==O.height)O.depthTexture.image.width=O.width,O.depthTexture.image.height=O.height,O.depthTexture.needsUpdate=!0;t(O.depthTexture,0);let J0=a.__webglTexture,s=N0(O);if(O.depthTexture.format===w$)if(q0(O))k.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER,$.DEPTH_ATTACHMENT,$.TEXTURE_2D,J0,0,s);else $.framebufferTexture2D($.FRAMEBUFFER,$.DEPTH_ATTACHMENT,$.TEXTURE_2D,J0,0);else if(O.depthTexture.format===E6)if(q0(O))k.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER,$.DEPTH_STENCIL_ATTACHMENT,$.TEXTURE_2D,J0,0,s);else $.framebufferTexture2D($.FRAMEBUFFER,$.DEPTH_STENCIL_ATTACHMENT,$.TEXTURE_2D,J0,0);else throw Error("Unknown depthTexture format")}function _0(I){let O=M.get(I),b=I.isWebGLCubeRenderTarget===!0;if(O.__boundDepthTexture!==I.depthTexture){let a=I.depthTexture;if(O.__depthDisposeCallback)O.__depthDisposeCallback();if(a){let J0=()=>{delete O.__boundDepthTexture,delete O.__depthDisposeCallback,a.removeEventListener("dispose",J0)};a.addEventListener("dispose",J0),O.__depthDisposeCallback=J0}O.__boundDepthTexture=a}if(I.depthTexture&&!O.__autoAllocateDepthBuffer){if(b)throw Error("target.depthTexture not supported in Cube render targets");let a=I.texture.mipmaps;if(a&&a.length>0)T0(O.__webglFramebuffer[0],I);else T0(O.__webglFramebuffer,I)}else if(b){O.__webglDepthbuffer=[];for(let a=0;a<6;a++)if(Q.bindFramebuffer($.FRAMEBUFFER,O.__webglFramebuffer[a]),O.__webglDepthbuffer[a]===void 0)O.__webglDepthbuffer[a]=$.createRenderbuffer(),y0(O.__webglDepthbuffer[a],I,!1);else{let J0=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,s=O.__webglDepthbuffer[a];$.bindRenderbuffer($.RENDERBUFFER,s),$.framebufferRenderbuffer($.FRAMEBUFFER,J0,$.RENDERBUFFER,s)}}else{let a=I.texture.mipmaps;if(a&&a.length>0)Q.bindFramebuffer($.FRAMEBUFFER,O.__webglFramebuffer[0]);else Q.bindFramebuffer($.FRAMEBUFFER,O.__webglFramebuffer);if(O.__webglDepthbuffer===void 0)O.__webglDepthbuffer=$.createRenderbuffer(),y0(O.__webglDepthbuffer,I,!1);else{let J0=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,s=O.__webglDepthbuffer;$.bindRenderbuffer($.RENDERBUFFER,s),$.framebufferRenderbuffer($.FRAMEBUFFER,J0,$.RENDERBUFFER,s)}}Q.bindFramebuffer($.FRAMEBUFFER,null)}function T(I,O,b){let a=M.get(I);if(O!==void 0)X0(a.__webglFramebuffer,I,I.texture,$.COLOR_ATTACHMENT0,$.TEXTURE_2D,0);if(b!==void 0)_0(I)}function l0(I){let O=I.texture,b=M.get(I),a=M.get(O);I.addEventListener("dispose",z);let J0=I.textures,s=I.isWebGLCubeRenderTarget===!0,O0=J0.length>1;if(!O0){if(a.__webglTexture===void 0)a.__webglTexture=$.createTexture();a.__version=O.version,W.memory.textures++}if(s){b.__webglFramebuffer=[];for(let E0=0;E0<6;E0++)if(O.mipmaps&&O.mipmaps.length>0){b.__webglFramebuffer[E0]=[];for(let L0=0;L0<O.mipmaps.length;L0++)b.__webglFramebuffer[E0][L0]=$.createFramebuffer()}else b.__webglFramebuffer[E0]=$.createFramebuffer()}else{if(O.mipmaps&&O.mipmaps.length>0){b.__webglFramebuffer=[];for(let E0=0;E0<O.mipmaps.length;E0++)b.__webglFramebuffer[E0]=$.createFramebuffer()}else b.__webglFramebuffer=$.createFramebuffer();if(O0)for(let E0=0,L0=J0.length;E0<L0;E0++){let S0=M.get(J0[E0]);if(S0.__webglTexture===void 0)S0.__webglTexture=$.createTexture(),W.memory.textures++}if(I.samples>0&&q0(I)===!1){b.__webglMultisampledFramebuffer=$.createFramebuffer(),b.__webglColorRenderbuffer=[],Q.bindFramebuffer($.FRAMEBUFFER,b.__webglMultisampledFramebuffer);for(let E0=0;E0<J0.length;E0++){let L0=J0[E0];b.__webglColorRenderbuffer[E0]=$.createRenderbuffer(),$.bindRenderbuffer($.RENDERBUFFER,b.__webglColorRenderbuffer[E0]);let S0=K.convert(L0.format,L0.colorSpace),H0=K.convert(L0.type),R0=D(L0.internalFormat,S0,H0,L0.colorSpace,I.isXRRenderTarget===!0),C0=N0(I);$.renderbufferStorageMultisample($.RENDERBUFFER,C0,R0,I.width,I.height),$.framebufferRenderbuffer($.FRAMEBUFFER,$.COLOR_ATTACHMENT0+E0,$.RENDERBUFFER,b.__webglColorRenderbuffer[E0])}if($.bindRenderbuffer($.RENDERBUFFER,null),I.depthBuffer)b.__webglDepthRenderbuffer=$.createRenderbuffer(),y0(b.__webglDepthRenderbuffer,I,!0);Q.bindFramebuffer($.FRAMEBUFFER,null)}}if(s){Q.bindTexture($.TEXTURE_CUBE_MAP,a.__webglTexture),b0($.TEXTURE_CUBE_MAP,O);for(let E0=0;E0<6;E0++)if(O.mipmaps&&O.mipmaps.length>0)for(let L0=0;L0<O.mipmaps.length;L0++)X0(b.__webglFramebuffer[E0][L0],I,O,$.COLOR_ATTACHMENT0,$.TEXTURE_CUBE_MAP_POSITIVE_X+E0,L0);else X0(b.__webglFramebuffer[E0],I,O,$.COLOR_ATTACHMENT0,$.TEXTURE_CUBE_MAP_POSITIVE_X+E0,0);if(Y(O))N($.TEXTURE_CUBE_MAP);Q.unbindTexture()}else if(O0){for(let E0=0,L0=J0.length;E0<L0;E0++){let S0=J0[E0],H0=M.get(S0),R0=$.TEXTURE_2D;if(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)R0=I.isWebGL3DRenderTarget?$.TEXTURE_3D:$.TEXTURE_2D_ARRAY;if(Q.bindTexture(R0,H0.__webglTexture),b0(R0,S0),X0(b.__webglFramebuffer,I,S0,$.COLOR_ATTACHMENT0+E0,R0,0),Y(S0))N(R0)}Q.unbindTexture()}else{let E0=$.TEXTURE_2D;if(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)E0=I.isWebGL3DRenderTarget?$.TEXTURE_3D:$.TEXTURE_2D_ARRAY;if(Q.bindTexture(E0,a.__webglTexture),b0(E0,O),O.mipmaps&&O.mipmaps.length>0)for(let L0=0;L0<O.mipmaps.length;L0++)X0(b.__webglFramebuffer[L0],I,O,$.COLOR_ATTACHMENT0,E0,L0);else X0(b.__webglFramebuffer,I,O,$.COLOR_ATTACHMENT0,E0,0);if(Y(O))N(E0);Q.unbindTexture()}if(I.depthBuffer)_0(I)}function B0(I){let O=I.textures;for(let b=0,a=O.length;b<a;b++){let J0=O[b];if(Y(J0)){let s=B(I),O0=M.get(J0).__webglTexture;Q.bindTexture(s,O0),N(s),Q.unbindTexture()}}}let p0=[],D0=[];function d0(I){if(I.samples>0){if(q0(I)===!1){let{textures:O,width:b,height:a}=I,J0=$.COLOR_BUFFER_BIT,s=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,O0=M.get(I),E0=O.length>1;if(E0)for(let S0=0;S0<O.length;S0++)Q.bindFramebuffer($.FRAMEBUFFER,O0.__webglMultisampledFramebuffer),$.framebufferRenderbuffer($.FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.RENDERBUFFER,null),Q.bindFramebuffer($.FRAMEBUFFER,O0.__webglFramebuffer),$.framebufferTexture2D($.DRAW_FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.TEXTURE_2D,null,0);Q.bindFramebuffer($.READ_FRAMEBUFFER,O0.__webglMultisampledFramebuffer);let L0=I.texture.mipmaps;if(L0&&L0.length>0)Q.bindFramebuffer($.DRAW_FRAMEBUFFER,O0.__webglFramebuffer[0]);else Q.bindFramebuffer($.DRAW_FRAMEBUFFER,O0.__webglFramebuffer);for(let S0=0;S0<O.length;S0++){if(I.resolveDepthBuffer){if(I.depthBuffer)J0|=$.DEPTH_BUFFER_BIT;if(I.stencilBuffer&&I.resolveStencilBuffer)J0|=$.STENCIL_BUFFER_BIT}if(E0){$.framebufferRenderbuffer($.READ_FRAMEBUFFER,$.COLOR_ATTACHMENT0,$.RENDERBUFFER,O0.__webglColorRenderbuffer[S0]);let H0=M.get(O[S0]).__webglTexture;$.framebufferTexture2D($.DRAW_FRAMEBUFFER,$.COLOR_ATTACHMENT0,$.TEXTURE_2D,H0,0)}if($.blitFramebuffer(0,0,b,a,0,0,b,a,J0,$.NEAREST),E===!0){if(p0.length=0,D0.length=0,p0.push($.COLOR_ATTACHMENT0+S0),I.depthBuffer&&I.resolveDepthBuffer===!1)p0.push(s),D0.push(s),$.invalidateFramebuffer($.DRAW_FRAMEBUFFER,D0);$.invalidateFramebuffer($.READ_FRAMEBUFFER,p0)}}if(Q.bindFramebuffer($.READ_FRAMEBUFFER,null),Q.bindFramebuffer($.DRAW_FRAMEBUFFER,null),E0)for(let S0=0;S0<O.length;S0++){Q.bindFramebuffer($.FRAMEBUFFER,O0.__webglMultisampledFramebuffer),$.framebufferRenderbuffer($.FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.RENDERBUFFER,O0.__webglColorRenderbuffer[S0]);let H0=M.get(O[S0]).__webglTexture;Q.bindFramebuffer($.FRAMEBUFFER,O0.__webglFramebuffer),$.framebufferTexture2D($.DRAW_FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.TEXTURE_2D,H0,0)}Q.bindFramebuffer($.DRAW_FRAMEBUFFER,O0.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.resolveDepthBuffer===!1&&E){let O=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT;$.invalidateFramebuffer($.DRAW_FRAMEBUFFER,[O])}}}function N0(I){return Math.min(H.maxSamples,I.samples)}function q0(I){let O=M.get(I);return I.samples>0&&J.has("WEBGL_multisampled_render_to_texture")===!0&&O.__useRenderToTexture!==!1}function J1(I){let O=W.render.frame;if(R.get(I)!==O)R.set(I,O),I.update()}function t0(I,O){let{colorSpace:b,format:a,type:J0}=I;if(I.isCompressedTexture===!0||I.isVideoTexture===!0)return O;if(b!==w6&&b!==r5)if(i0.getTransfer(b)===K1){if(a!==e1||J0!==U5)console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else console.error("THREE.WebGLTextures: Unsupported texture color space:",b);return O}function W1(I){if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement)w.width=I.naturalWidth||I.width,w.height=I.naturalHeight||I.height;else if(typeof VideoFrame<"u"&&I instanceof VideoFrame)w.width=I.displayWidth,w.height=I.displayHeight;else w.width=I.width,w.height=I.height;return w}this.allocateTextureUnit=x,this.resetTextureUnits=u,this.setTexture2D=t,this.setTexture2DArray=d,this.setTexture3D=e,this.setTextureCube=g,this.rebindTextures=T,this.setupRenderTarget=l0,this.updateRenderTargetMipmap=B0,this.updateMultisampleRenderTarget=d0,this.setupDepthRenderbuffer=_0,this.setupFrameBufferTexture=X0,this.useMultisampledRTT=q0}function Uw($,J){function Q(M,H=r5){let K,W=i0.getTransfer(H);if(M===U5)return $.UNSIGNED_BYTE;if(M===I9)return $.UNSIGNED_SHORT_4_4_4_4;if(M===C9)return $.UNSIGNED_SHORT_5_5_5_1;if(M===OQ)return $.UNSIGNED_INT_5_9_9_9_REV;if(M===DQ)return $.BYTE;if(M===qQ)return $.SHORT;if(M===W6)return $.UNSIGNED_SHORT;if(M===B9)return $.INT;if(M===S8)return $.UNSIGNED_INT;if(M===y5)return $.FLOAT;if(M===k6)return $.HALF_FLOAT;if(M===FQ)return $.ALPHA;if(M===LQ)return $.RGB;if(M===e1)return $.RGBA;if(M===w$)return $.DEPTH_COMPONENT;if(M===E6)return $.DEPTH_STENCIL;if(M===PQ)return $.RED;if(M===_9)return $.RED_INTEGER;if(M===VQ)return $.RG;if(M===A9)return $.RG_INTEGER;if(M===S9)return $.RGBA_INTEGER;if(M===Z$||M===R$||M===U$||M===Y$)if(W===K1)if(K=J.get("WEBGL_compressed_texture_s3tc_srgb"),K!==null){if(M===Z$)return K.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(M===R$)return K.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(M===U$)return K.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(M===Y$)return K.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(K=J.get("WEBGL_compressed_texture_s3tc"),K!==null){if(M===Z$)return K.COMPRESSED_RGB_S3TC_DXT1_EXT;if(M===R$)return K.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(M===U$)return K.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(M===Y$)return K.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(M===T9||M===h9||M===f9||M===j9)if(K=J.get("WEBGL_compressed_texture_pvrtc"),K!==null){if(M===T9)return K.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(M===h9)return K.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(M===f9)return K.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(M===j9)return K.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(M===y9||M===v9||M===b9)if(K=J.get("WEBGL_compressed_texture_etc"),K!==null){if(M===y9||M===v9)return W===K1?K.COMPRESSED_SRGB8_ETC2:K.COMPRESSED_RGB8_ETC2;if(M===b9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:K.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(M===p9||M===x9||M===g9||M===l9||M===d9||M===m9||M===u9||M===c9||M===n9||M===s9||M===o9||M===i9||M===a9||M===r9)if(K=J.get("WEBGL_compressed_texture_astc"),K!==null){if(M===p9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:K.COMPRESSED_RGBA_ASTC_4x4_KHR;if(M===x9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:K.COMPRESSED_RGBA_ASTC_5x4_KHR;if(M===g9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:K.COMPRESSED_RGBA_ASTC_5x5_KHR;if(M===l9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:K.COMPRESSED_RGBA_ASTC_6x5_KHR;if(M===d9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:K.COMPRESSED_RGBA_ASTC_6x6_KHR;if(M===m9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:K.COMPRESSED_RGBA_ASTC_8x5_KHR;if(M===u9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:K.COMPRESSED_RGBA_ASTC_8x6_KHR;if(M===c9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:K.COMPRESSED_RGBA_ASTC_8x8_KHR;if(M===n9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:K.COMPRESSED_RGBA_ASTC_10x5_KHR;if(M===s9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:K.COMPRESSED_RGBA_ASTC_10x6_KHR;if(M===o9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:K.COMPRESSED_RGBA_ASTC_10x8_KHR;if(M===i9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:K.COMPRESSED_RGBA_ASTC_10x10_KHR;if(M===a9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:K.COMPRESSED_RGBA_ASTC_12x10_KHR;if(M===r9)return W===K1?K.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:K.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(M===N$||M===t9||M===e9)if(K=J.get("EXT_texture_compression_bptc"),K!==null){if(M===N$)return W===K1?K.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:K.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(M===t9)return K.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(M===e9)return K.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(M===zQ||M===$J||M===JJ||M===QJ)if(K=J.get("EXT_texture_compression_rgtc"),K!==null){if(M===N$)return K.COMPRESSED_RED_RGTC1_EXT;if(M===$J)return K.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(M===JJ)return K.COMPRESSED_RED_GREEN_RGTC2_EXT;if(M===QJ)return K.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(M===T8)return $.UNSIGNED_INT_24_8;return $[M]!==void 0?$[M]:null}return{convert:Q}}class xJ extends A1{constructor($=null){super();this.sourceTexture=$,this.isExternalTexture=!0}}var Yw=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Nw=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class LM{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init($,J){if(this.texture===null){let Q=new xJ($.texture);if($.depthNear!==J.depthNear||$.depthFar!==J.depthFar)this.depthNear=$.depthNear,this.depthFar=$.depthFar;this.texture=Q}}getMesh($){if(this.texture!==null){if(this.mesh===null){let J=$.cameras[0].viewport,Q=new J5({vertexShader:Yw,fragmentShader:Nw,uniforms:{depthColor:{value:this.texture},depthWidth:{value:J.z},depthHeight:{value:J.w}}});this.mesh=new f1(new N6(20,20),Q)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class PM extends v5{constructor($,J){super();let Q=this,M=null,H=1,K=null,W="local-floor",k=1,E=null,w=null,R=null,Z=null,U=null,X=null,G=new LM,q={},Y=J.getContextAttributes(),N=null,B=null,D=[],V=[],h=new $1,C=null,z=new F1;z.viewport=new U1;let y=new F1;y.viewport=new U1;let P=[z,y],F=new IJ,f=null,u=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(p){let M0=D[p];if(M0===void 0)M0=new U6,D[p]=M0;return M0.getTargetRaySpace()},this.getControllerGrip=function(p){let M0=D[p];if(M0===void 0)M0=new U6,D[p]=M0;return M0.getGripSpace()},this.getHand=function(p){let M0=D[p];if(M0===void 0)M0=new U6,D[p]=M0;return M0.getHandSpace()};function x(p){let M0=V.indexOf(p.inputSource);if(M0===-1)return;let U0=D[M0];if(U0!==void 0)U0.update(p.inputSource,p.frame,E||K),U0.dispatchEvent({type:p.type,data:p.inputSource})}function c(){M.removeEventListener("select",x),M.removeEventListener("selectstart",x),M.removeEventListener("selectend",x),M.removeEventListener("squeeze",x),M.removeEventListener("squeezestart",x),M.removeEventListener("squeezeend",x),M.removeEventListener("end",c),M.removeEventListener("inputsourceschange",t);for(let p=0;p<D.length;p++){let M0=V[p];if(M0===null)continue;V[p]=null,D[p].disconnect(M0)}f=null,u=null,G.reset();for(let p in q)delete q[p];$.setRenderTarget(N),U=null,Z=null,R=null,M=null,B=null,c0.stop(),Q.isPresenting=!1,$.setPixelRatio(C),$.setSize(h.width,h.height,!1),Q.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(p){if(H=p,Q.isPresenting===!0)console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(p){if(W=p,Q.isPresenting===!0)console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return E||K},this.setReferenceSpace=function(p){E=p},this.getBaseLayer=function(){return Z!==null?Z:U},this.getBinding=function(){return R},this.getFrame=function(){return X},this.getSession=function(){return M},this.setSession=async function(p){if(M=p,M!==null){if(N=$.getRenderTarget(),M.addEventListener("select",x),M.addEventListener("selectstart",x),M.addEventListener("selectend",x),M.addEventListener("squeeze",x),M.addEventListener("squeezestart",x),M.addEventListener("squeezeend",x),M.addEventListener("end",c),M.addEventListener("inputsourceschange",t),Y.xrCompatible!==!0)await J.makeXRCompatible();if(C=$.getPixelRatio(),$.getSize(h),typeof XRWebGLBinding<"u")R=new XRWebGLBinding(M,J);if(!(R!==null&&("createProjectionLayer"in XRWebGLBinding.prototype))){let U0={antialias:Y.antialias,alpha:!0,depth:Y.depth,stencil:Y.stencil,framebufferScaleFactor:H};U=new XRWebGLLayer(M,J,U0),M.updateRenderState({baseLayer:U}),$.setPixelRatio(1),$.setSize(U.framebufferWidth,U.framebufferHeight,!1),B=new $5(U.framebufferWidth,U.framebufferHeight,{format:e1,type:U5,colorSpace:$.outputColorSpace,stencilBuffer:Y.stencil,resolveDepthBuffer:U.ignoreDepthValues===!1,resolveStencilBuffer:U.ignoreDepthValues===!1})}else{let U0=null,Z0=null,X0=null;if(Y.depth)X0=Y.stencil?J.DEPTH24_STENCIL8:J.DEPTH_COMPONENT24,U0=Y.stencil?E6:w$,Z0=Y.stencil?T8:S8;let y0={colorFormat:J.RGBA8,depthFormat:X0,scaleFactor:H};Z=R.createProjectionLayer(y0),M.updateRenderState({layers:[Z]}),$.setPixelRatio(1),$.setSize(Z.textureWidth,Z.textureHeight,!1),B=new $5(Z.textureWidth,Z.textureHeight,{format:e1,type:U5,depthTexture:new j8(Z.textureWidth,Z.textureHeight,Z0,void 0,void 0,void 0,void 0,void 0,void 0,U0),stencilBuffer:Y.stencil,colorSpace:$.outputColorSpace,samples:Y.antialias?4:0,resolveDepthBuffer:Z.ignoreDepthValues===!1,resolveStencilBuffer:Z.ignoreDepthValues===!1})}B.isXRRenderTarget=!0,this.setFoveation(k),E=null,K=await M.requestReferenceSpace(W),c0.setContext(M),c0.start(),Q.isPresenting=!0,Q.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(M!==null)return M.environmentBlendMode},this.getDepthTexture=function(){return G.getDepthTexture()};function t(p){for(let M0=0;M0<p.removed.length;M0++){let U0=p.removed[M0],Z0=V.indexOf(U0);if(Z0>=0)V[Z0]=null,D[Z0].disconnect(U0)}for(let M0=0;M0<p.added.length;M0++){let U0=p.added[M0],Z0=V.indexOf(U0);if(Z0===-1){for(let y0=0;y0<D.length;y0++)if(y0>=V.length){V.push(U0),Z0=y0;break}else if(V[y0]===null){V[y0]=U0,Z0=y0;break}if(Z0===-1)break}let X0=D[Z0];if(X0)X0.connect(U0)}}let d=new S,e=new S;function g(p,M0,U0){d.setFromMatrixPosition(M0.matrixWorld),e.setFromMatrixPosition(U0.matrixWorld);let Z0=d.distanceTo(e),X0=M0.projectionMatrix.elements,y0=U0.projectionMatrix.elements,T0=X0[14]/(X0[10]-1),_0=X0[14]/(X0[10]+1),T=(X0[9]+1)/X0[5],l0=(X0[9]-1)/X0[5],B0=(X0[8]-1)/X0[0],p0=(y0[8]+1)/y0[0],D0=T0*B0,d0=T0*p0,N0=Z0/(-B0+p0),q0=N0*-B0;if(M0.matrixWorld.decompose(p.position,p.quaternion,p.scale),p.translateX(q0),p.translateZ(N0),p.matrixWorld.compose(p.position,p.quaternion,p.scale),p.matrixWorldInverse.copy(p.matrixWorld).invert(),X0[10]===-1)p.projectionMatrix.copy(M0.projectionMatrix),p.projectionMatrixInverse.copy(M0.projectionMatrixInverse);else{let J1=T0+N0,t0=_0+N0,W1=D0-q0,I=d0+(Z0-q0),O=T*_0/t0*J1,b=l0*_0/t0*J1;p.projectionMatrix.makePerspective(W1,I,O,b,J1,t0),p.projectionMatrixInverse.copy(p.projectionMatrix).invert()}}function W0(p,M0){if(M0===null)p.matrixWorld.copy(p.matrix);else p.matrixWorld.multiplyMatrices(M0.matrixWorld,p.matrix);p.matrixWorldInverse.copy(p.matrixWorld).invert()}this.updateCamera=function(p){if(M===null)return;let{near:M0,far:U0}=p;if(G.texture!==null){if(G.depthNear>0)M0=G.depthNear;if(G.depthFar>0)U0=G.depthFar}if(F.near=y.near=z.near=M0,F.far=y.far=z.far=U0,f!==F.near||u!==F.far)M.updateRenderState({depthNear:F.near,depthFar:F.far}),f=F.near,u=F.far;F.layers.mask=p.layers.mask|6,z.layers.mask=F.layers.mask&3,y.layers.mask=F.layers.mask&5;let Z0=p.parent,X0=F.cameras;W0(F,Z0);for(let y0=0;y0<X0.length;y0++)W0(X0[y0],Z0);if(X0.length===2)g(F,z,y);else F.projectionMatrix.copy(z.projectionMatrix);w0(p,F,Z0)};function w0(p,M0,U0){if(U0===null)p.matrix.copy(M0.matrixWorld);else p.matrix.copy(U0.matrixWorld),p.matrix.invert(),p.matrix.multiply(M0.matrixWorld);if(p.matrix.decompose(p.position,p.quaternion,p.scale),p.updateMatrixWorld(!0),p.projectionMatrix.copy(M0.projectionMatrix),p.projectionMatrixInverse.copy(M0.projectionMatrixInverse),p.isPerspectiveCamera)p.fov=r6*2*Math.atan(1/p.projectionMatrix.elements[5]),p.zoom=1}this.getCamera=function(){return F},this.getFoveation=function(){if(Z===null&&U===null)return;return k},this.setFoveation=function(p){if(k=p,Z!==null)Z.fixedFoveation=p;if(U!==null&&U.fixedFoveation!==void 0)U.fixedFoveation=p},this.hasDepthSensing=function(){return G.texture!==null},this.getDepthSensingMesh=function(){return G.getMesh(F)},this.getCameraTexture=function(p){return q[p]};let z0=null;function b0(p,M0){if(w=M0.getViewerPose(E||K),X=M0,w!==null){let U0=w.views;if(U!==null)$.setRenderTargetFramebuffer(B,U.framebuffer),$.setRenderTarget(B);let Z0=!1;if(U0.length!==F.cameras.length)F.cameras.length=0,Z0=!0;for(let _0=0;_0<U0.length;_0++){let T=U0[_0],l0=null;if(U!==null)l0=U.getViewport(T);else{let p0=R.getViewSubImage(Z,T);if(l0=p0.viewport,_0===0)$.setRenderTargetTextures(B,p0.colorTexture,p0.depthStencilTexture),$.setRenderTarget(B)}let B0=P[_0];if(B0===void 0)B0=new F1,B0.layers.enable(_0),B0.viewport=new U1,P[_0]=B0;if(B0.matrix.fromArray(T.transform.matrix),B0.matrix.decompose(B0.position,B0.quaternion,B0.scale),B0.projectionMatrix.fromArray(T.projectionMatrix),B0.projectionMatrixInverse.copy(B0.projectionMatrix).invert(),B0.viewport.set(l0.x,l0.y,l0.width,l0.height),_0===0)F.matrix.copy(B0.matrix),F.matrix.decompose(F.position,F.quaternion,F.scale);if(Z0===!0)F.cameras.push(B0)}let X0=M.enabledFeatures;if(X0&&X0.includes("depth-sensing")&&M.depthUsage=="gpu-optimized"&&R){let _0=R.getDepthInformation(U0[0]);if(_0&&_0.isValid&&_0.texture)G.init(_0,M.renderState)}if(X0&&X0.includes("camera-access")){if($.state.unbindTexture(),R)for(let _0=0;_0<U0.length;_0++){let T=U0[_0].camera;if(T){let l0=q[T];if(!l0)l0=new xJ,q[T]=l0;let B0=R.getCameraImage(T);l0.sourceTexture=B0}}}}for(let U0=0;U0<D.length;U0++){let Z0=V[U0],X0=D[U0];if(Z0!==null&&X0!==void 0)X0.update(Z0,M0,E||K)}if(z0)z0(p,M0);if(M0.detectedPlanes)Q.dispatchEvent({type:"planesdetected",data:M0});X=null}let c0=new RM;c0.setAnimationLoop(b0),this.setAnimationLoop=function(p){z0=p},this.dispose=function(){}}}var H8=new d1,Xw=new M1;function Gw($,J){function Q(Y,N){if(Y.matrixAutoUpdate===!0)Y.updateMatrix();N.value.copy(Y.matrix)}function M(Y,N){if(N.color.getRGB(Y.fogColor.value,RJ($)),N.isFog)Y.fogNear.value=N.near,Y.fogFar.value=N.far;else if(N.isFogExp2)Y.fogDensity.value=N.density}function H(Y,N,B,D,V){if(N.isMeshBasicMaterial)K(Y,N);else if(N.isMeshLambertMaterial)K(Y,N);else if(N.isMeshToonMaterial)K(Y,N),Z(Y,N);else if(N.isMeshPhongMaterial)K(Y,N),R(Y,N);else if(N.isMeshStandardMaterial){if(K(Y,N),U(Y,N),N.isMeshPhysicalMaterial)X(Y,N,V)}else if(N.isMeshMatcapMaterial)K(Y,N),G(Y,N);else if(N.isMeshDepthMaterial)K(Y,N);else if(N.isMeshDistanceMaterial)K(Y,N),q(Y,N);else if(N.isMeshNormalMaterial)K(Y,N);else if(N.isLineBasicMaterial){if(W(Y,N),N.isLineDashedMaterial)k(Y,N)}else if(N.isPointsMaterial)E(Y,N,B,D);else if(N.isSpriteMaterial)w(Y,N);else if(N.isShadowMaterial)Y.color.value.copy(N.color),Y.opacity.value=N.opacity;else if(N.isShaderMaterial)N.uniformsNeedUpdate=!1}function K(Y,N){if(Y.opacity.value=N.opacity,N.color)Y.diffuse.value.copy(N.color);if(N.emissive)Y.emissive.value.copy(N.emissive).multiplyScalar(N.emissiveIntensity);if(N.map)Y.map.value=N.map,Q(N.map,Y.mapTransform);if(N.alphaMap)Y.alphaMap.value=N.alphaMap,Q(N.alphaMap,Y.alphaMapTransform);if(N.bumpMap){if(Y.bumpMap.value=N.bumpMap,Q(N.bumpMap,Y.bumpMapTransform),Y.bumpScale.value=N.bumpScale,N.side===m1)Y.bumpScale.value*=-1}if(N.normalMap){if(Y.normalMap.value=N.normalMap,Q(N.normalMap,Y.normalMapTransform),Y.normalScale.value.copy(N.normalScale),N.side===m1)Y.normalScale.value.negate()}if(N.displacementMap)Y.displacementMap.value=N.displacementMap,Q(N.displacementMap,Y.displacementMapTransform),Y.displacementScale.value=N.displacementScale,Y.displacementBias.value=N.displacementBias;if(N.emissiveMap)Y.emissiveMap.value=N.emissiveMap,Q(N.emissiveMap,Y.emissiveMapTransform);if(N.specularMap)Y.specularMap.value=N.specularMap,Q(N.specularMap,Y.specularMapTransform);if(N.alphaTest>0)Y.alphaTest.value=N.alphaTest;let B=J.get(N),D=B.envMap,V=B.envMapRotation;if(D){if(Y.envMap.value=D,H8.copy(V),H8.x*=-1,H8.y*=-1,H8.z*=-1,D.isCubeTexture&&D.isRenderTargetTexture===!1)H8.y*=-1,H8.z*=-1;Y.envMapRotation.value.setFromMatrix4(Xw.makeRotationFromEuler(H8)),Y.flipEnvMap.value=D.isCubeTexture&&D.isRenderTargetTexture===!1?-1:1,Y.reflectivity.value=N.reflectivity,Y.ior.value=N.ior,Y.refractionRatio.value=N.refractionRatio}if(N.lightMap)Y.lightMap.value=N.lightMap,Y.lightMapIntensity.value=N.lightMapIntensity,Q(N.lightMap,Y.lightMapTransform);if(N.aoMap)Y.aoMap.value=N.aoMap,Y.aoMapIntensity.value=N.aoMapIntensity,Q(N.aoMap,Y.aoMapTransform)}function W(Y,N){if(Y.diffuse.value.copy(N.color),Y.opacity.value=N.opacity,N.map)Y.map.value=N.map,Q(N.map,Y.mapTransform)}function k(Y,N){Y.dashSize.value=N.dashSize,Y.totalSize.value=N.dashSize+N.gapSize,Y.scale.value=N.scale}function E(Y,N,B,D){if(Y.diffuse.value.copy(N.color),Y.opacity.value=N.opacity,Y.size.value=N.size*B,Y.scale.value=D*0.5,N.map)Y.map.value=N.map,Q(N.map,Y.uvTransform);if(N.alphaMap)Y.alphaMap.value=N.alphaMap,Q(N.alphaMap,Y.alphaMapTransform);if(N.alphaTest>0)Y.alphaTest.value=N.alphaTest}function w(Y,N){if(Y.diffuse.value.copy(N.color),Y.opacity.value=N.opacity,Y.rotation.value=N.rotation,N.map)Y.map.value=N.map,Q(N.map,Y.mapTransform);if(N.alphaMap)Y.alphaMap.value=N.alphaMap,Q(N.alphaMap,Y.alphaMapTransform);if(N.alphaTest>0)Y.alphaTest.value=N.alphaTest}function R(Y,N){Y.specular.value.copy(N.specular),Y.shininess.value=Math.max(N.shininess,0.0001)}function Z(Y,N){if(N.gradientMap)Y.gradientMap.value=N.gradientMap}function U(Y,N){if(Y.metalness.value=N.metalness,N.metalnessMap)Y.metalnessMap.value=N.metalnessMap,Q(N.metalnessMap,Y.metalnessMapTransform);if(Y.roughness.value=N.roughness,N.roughnessMap)Y.roughnessMap.value=N.roughnessMap,Q(N.roughnessMap,Y.roughnessMapTransform);if(N.envMap)Y.envMapIntensity.value=N.envMapIntensity}function X(Y,N,B){if(Y.ior.value=N.ior,N.sheen>0){if(Y.sheenColor.value.copy(N.sheenColor).multiplyScalar(N.sheen),Y.sheenRoughness.value=N.sheenRoughness,N.sheenColorMap)Y.sheenColorMap.value=N.sheenColorMap,Q(N.sheenColorMap,Y.sheenColorMapTransform);if(N.sheenRoughnessMap)Y.sheenRoughnessMap.value=N.sheenRoughnessMap,Q(N.sheenRoughnessMap,Y.sheenRoughnessMapTransform)}if(N.clearcoat>0){if(Y.clearcoat.value=N.clearcoat,Y.clearcoatRoughness.value=N.clearcoatRoughness,N.clearcoatMap)Y.clearcoatMap.value=N.clearcoatMap,Q(N.clearcoatMap,Y.clearcoatMapTransform);if(N.clearcoatRoughnessMap)Y.clearcoatRoughnessMap.value=N.clearcoatRoughnessMap,Q(N.clearcoatRoughnessMap,Y.clearcoatRoughnessMapTransform);if(N.clearcoatNormalMap){if(Y.clearcoatNormalMap.value=N.clearcoatNormalMap,Q(N.clearcoatNormalMap,Y.clearcoatNormalMapTransform),Y.clearcoatNormalScale.value.copy(N.clearcoatNormalScale),N.side===m1)Y.clearcoatNormalScale.value.negate()}}if(N.dispersion>0)Y.dispersion.value=N.dispersion;if(N.iridescence>0){if(Y.iridescence.value=N.iridescence,Y.iridescenceIOR.value=N.iridescenceIOR,Y.iridescenceThicknessMinimum.value=N.iridescenceThicknessRange[0],Y.iridescenceThicknessMaximum.value=N.iridescenceThicknessRange[1],N.iridescenceMap)Y.iridescenceMap.value=N.iridescenceMap,Q(N.iridescenceMap,Y.iridescenceMapTransform);if(N.iridescenceThicknessMap)Y.iridescenceThicknessMap.value=N.iridescenceThicknessMap,Q(N.iridescenceThicknessMap,Y.iridescenceThicknessMapTransform)}if(N.transmission>0){if(Y.transmission.value=N.transmission,Y.transmissionSamplerMap.value=B.texture,Y.transmissionSamplerSize.value.set(B.width,B.height),N.transmissionMap)Y.transmissionMap.value=N.transmissionMap,Q(N.transmissionMap,Y.transmissionMapTransform);if(Y.thickness.value=N.thickness,N.thicknessMap)Y.thicknessMap.value=N.thicknessMap,Q(N.thicknessMap,Y.thicknessMapTransform);Y.attenuationDistance.value=N.attenuationDistance,Y.attenuationColor.value.copy(N.attenuationColor)}if(N.anisotropy>0){if(Y.anisotropyVector.value.set(N.anisotropy*Math.cos(N.anisotropyRotation),N.anisotropy*Math.sin(N.anisotropyRotation)),N.anisotropyMap)Y.anisotropyMap.value=N.anisotropyMap,Q(N.anisotropyMap,Y.anisotropyMapTransform)}if(Y.specularIntensity.value=N.specularIntensity,Y.specularColor.value.copy(N.specularColor),N.specularColorMap)Y.specularColorMap.value=N.specularColorMap,Q(N.specularColorMap,Y.specularColorMapTransform);if(N.specularIntensityMap)Y.specularIntensityMap.value=N.specularIntensityMap,Q(N.specularIntensityMap,Y.specularIntensityMapTransform)}function G(Y,N){if(N.matcap)Y.matcap.value=N.matcap}function q(Y,N){let B=J.get(N).light;Y.referencePosition.value.setFromMatrixPosition(B.matrixWorld),Y.nearDistance.value=B.shadow.camera.near,Y.farDistance.value=B.shadow.camera.far}return{refreshFogUniforms:M,refreshMaterialUniforms:H}}function Dw($,J,Q,M){let H={},K={},W=[],k=$.getParameter($.MAX_UNIFORM_BUFFER_BINDINGS);function E(B,D){let V=D.program;M.uniformBlockBinding(B,V)}function w(B,D){let V=H[B.id];if(V===void 0)G(B),V=R(B),H[B.id]=V,B.addEventListener("dispose",Y);let h=D.program;M.updateUBOMapping(B,h);let C=J.render.frame;if(K[B.id]!==C)U(B),K[B.id]=C}function R(B){let D=Z();B.__bindingPointIndex=D;let V=$.createBuffer(),h=B.__size,C=B.usage;return $.bindBuffer($.UNIFORM_BUFFER,V),$.bufferData($.UNIFORM_BUFFER,h,C),$.bindBuffer($.UNIFORM_BUFFER,null),$.bindBufferBase($.UNIFORM_BUFFER,D,V),V}function Z(){for(let B=0;B<k;B++)if(W.indexOf(B)===-1)return W.push(B),B;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function U(B){let D=H[B.id],V=B.uniforms,h=B.__cache;$.bindBuffer($.UNIFORM_BUFFER,D);for(let C=0,z=V.length;C<z;C++){let y=Array.isArray(V[C])?V[C]:[V[C]];for(let P=0,F=y.length;P<F;P++){let f=y[P];if(X(f,C,P,h)===!0){let u=f.__offset,x=Array.isArray(f.value)?f.value:[f.value],c=0;for(let t=0;t<x.length;t++){let d=x[t],e=q(d);if(typeof d==="number"||typeof d==="boolean")f.__data[0]=d,$.bufferSubData($.UNIFORM_BUFFER,u+c,f.__data);else if(d.isMatrix3)f.__data[0]=d.elements[0],f.__data[1]=d.elements[1],f.__data[2]=d.elements[2],f.__data[3]=0,f.__data[4]=d.elements[3],f.__data[5]=d.elements[4],f.__data[6]=d.elements[5],f.__data[7]=0,f.__data[8]=d.elements[6],f.__data[9]=d.elements[7],f.__data[10]=d.elements[8],f.__data[11]=0;else d.toArray(f.__data,c),c+=e.storage/Float32Array.BYTES_PER_ELEMENT}$.bufferSubData($.UNIFORM_BUFFER,u,f.__data)}}}$.bindBuffer($.UNIFORM_BUFFER,null)}function X(B,D,V,h){let C=B.value,z=D+"_"+V;if(h[z]===void 0){if(typeof C==="number"||typeof C==="boolean")h[z]=C;else h[z]=C.clone();return!0}else{let y=h[z];if(typeof C==="number"||typeof C==="boolean"){if(y!==C)return h[z]=C,!0}else if(y.equals(C)===!1)return y.copy(C),!0}return!1}function G(B){let D=B.uniforms,V=0,h=16;for(let z=0,y=D.length;z<y;z++){let P=Array.isArray(D[z])?D[z]:[D[z]];for(let F=0,f=P.length;F<f;F++){let u=P[F],x=Array.isArray(u.value)?u.value:[u.value];for(let c=0,t=x.length;c<t;c++){let d=x[c],e=q(d),g=V%h,W0=g%e.boundary,w0=g+W0;if(V+=W0,w0!==0&&h-w0<e.storage)V+=h-w0;u.__data=new Float32Array(e.storage/Float32Array.BYTES_PER_ELEMENT),u.__offset=V,V+=e.storage}}}let C=V%h;if(C>0)V+=h-C;return B.__size=V,B.__cache={},this}function q(B){let D={boundary:0,storage:0};if(typeof B==="number"||typeof B==="boolean")D.boundary=4,D.storage=4;else if(B.isVector2)D.boundary=8,D.storage=8;else if(B.isVector3||B.isColor)D.boundary=16,D.storage=12;else if(B.isVector4)D.boundary=16,D.storage=16;else if(B.isMatrix3)D.boundary=48,D.storage=48;else if(B.isMatrix4)D.boundary=64,D.storage=64;else if(B.isTexture)console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group.");else console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",B);return D}function Y(B){let D=B.target;D.removeEventListener("dispose",Y);let V=W.indexOf(D.__bindingPointIndex);W.splice(V,1),$.deleteBuffer(H[D.id]),delete H[D.id],delete K[D.id]}function N(){for(let B in H)$.deleteBuffer(H[B]);W=[],H={},K={}}return{bind:E,update:w,dispose:N}}class gJ{constructor($={}){let{canvas:J=vQ(),context:Q=null,depth:M=!0,stencil:H=!1,alpha:K=!1,antialias:W=!1,premultipliedAlpha:k=!0,preserveDrawingBuffer:E=!1,powerPreference:w="default",failIfMajorPerformanceCaveat:R=!1,reversedDepthBuffer:Z=!1}=$;this.isWebGLRenderer=!0;let U;if(Q!==null){if(typeof WebGLRenderingContext<"u"&&Q instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");U=Q.getContextAttributes().alpha}else U=K;let X=new Uint32Array(4),G=new Int32Array(4),q=null,Y=null,N=[],B=[];this.domElement=J,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=z5,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let D=this,V=!1;this._outputColorSpace=_Q;let h=0,C=0,z=null,y=-1,P=null,F=new U1,f=new U1,u=null,x=new r0(0),c=0,t=J.width,d=J.height,e=1,g=null,W0=null,w0=new U1(0,0,t,d),z0=new U1(0,0,t,d),b0=!1,c0=new V$,p=!1,M0=!1,U0=new M1,Z0=new S,X0=new U1,y0={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},T0=!1;function _0(){return z===null?e:1}let T=Q;function l0(L,j){return J.getContext(L,j)}try{let L={alpha:!0,depth:M,stencil:H,antialias:W,premultipliedAlpha:k,preserveDrawingBuffer:E,powerPreference:w,failIfMajorPerformanceCaveat:R};if("setAttribute"in J)J.setAttribute("data-engine",`three.js r${f7}`);if(J.addEventListener("webglcontextlost",o,!1),J.addEventListener("webglcontextrestored",$0,!1),J.addEventListener("webglcontextcreationerror",k0,!1),T===null){if(T=l0("webgl2",L),T===null)if(l0("webgl2"))throw Error("Error creating WebGL context with your selected attributes.");else throw Error("Error creating WebGL context.")}}catch(L){throw console.error("THREE.WebGLRenderer: "+L.message),L}let B0,p0,D0,d0,N0,q0,J1,t0,W1,I,O,b,a,J0,s,O0,E0,L0,S0,H0,R0,C0,I0,A;function n(){if(B0=new yk(T),B0.init(),C0=new Uw(T,B0),p0=new _k(T,B0,$,C0),D0=new Zw(T,B0),p0.reversedDepthBuffer&&Z)D0.buffers.depth.setReversed(!0);d0=new pk(T),N0=new rE,q0=new Rw(T,B0,D0,N0,p0,C0,d0),J1=new Sk(D),t0=new jk(D),W1=new uH(T),I0=new Ik(T,W1),I=new vk(T,W1,d0,I0),O=new gk(T,I,W1,d0),S0=new xk(T,p0,q0),O0=new Ak(N0),b=new aE(D,J1,t0,B0,p0,I0,O0),a=new Gw(D,N0),J0=new eE,s=new Kw(B0),L0=new Bk(D,J1,t0,D0,O,U,k),E0=new Ew(D,O,p0),A=new Dw(T,d0,p0,D0),H0=new Ck(T,B0,d0),R0=new bk(T,B0,d0),d0.programs=b.programs,D.capabilities=p0,D.extensions=B0,D.properties=N0,D.renderLists=J0,D.shadowMap=E0,D.state=D0,D.info=d0}n();let _=new PM(D,T);this.xr=_,this.getContext=function(){return T},this.getContextAttributes=function(){return T.getContextAttributes()},this.forceContextLoss=function(){let L=B0.get("WEBGL_lose_context");if(L)L.loseContext()},this.forceContextRestore=function(){let L=B0.get("WEBGL_lose_context");if(L)L.restoreContext()},this.getPixelRatio=function(){return e},this.setPixelRatio=function(L){if(L===void 0)return;e=L,this.setSize(t,d,!1)},this.getSize=function(L){return L.set(t,d)},this.setSize=function(L,j,l=!0){if(_.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}if(t=L,d=j,J.width=Math.floor(L*e),J.height=Math.floor(j*e),l===!0)J.style.width=L+"px",J.style.height=j+"px";this.setViewport(0,0,L,j)},this.getDrawingBufferSize=function(L){return L.set(t*e,d*e).floor()},this.setDrawingBufferSize=function(L,j,l){t=L,d=j,e=l,J.width=Math.floor(L*l),J.height=Math.floor(j*l),this.setViewport(0,0,L,j)},this.getCurrentViewport=function(L){return L.copy(F)},this.getViewport=function(L){return L.copy(w0)},this.setViewport=function(L,j,l,m){if(L.isVector4)w0.set(L.x,L.y,L.z,L.w);else w0.set(L,j,l,m);D0.viewport(F.copy(w0).multiplyScalar(e).round())},this.getScissor=function(L){return L.copy(z0)},this.setScissor=function(L,j,l,m){if(L.isVector4)z0.set(L.x,L.y,L.z,L.w);else z0.set(L,j,l,m);D0.scissor(f.copy(z0).multiplyScalar(e).round())},this.getScissorTest=function(){return b0},this.setScissorTest=function(L){D0.setScissorTest(b0=L)},this.setOpaqueSort=function(L){g=L},this.setTransparentSort=function(L){W0=L},this.getClearColor=function(L){return L.copy(L0.getClearColor())},this.setClearColor=function(){L0.setClearColor(...arguments)},this.getClearAlpha=function(){return L0.getClearAlpha()},this.setClearAlpha=function(){L0.setClearAlpha(...arguments)},this.clear=function(L=!0,j=!0,l=!0){let m=0;if(L){let v=!1;if(z!==null){let K0=z.texture.format;v=K0===S9||K0===A9||K0===_9}if(v){let K0=z.texture.type,G0=K0===U5||K0===S8||K0===W6||K0===T8||K0===I9||K0===C9,V0=L0.getClearColor(),F0=L0.getClearAlpha(),f0=V0.r,j0=V0.g,A0=V0.b;if(G0)X[0]=f0,X[1]=j0,X[2]=A0,X[3]=F0,T.clearBufferuiv(T.COLOR,0,X);else G[0]=f0,G[1]=j0,G[2]=A0,G[3]=F0,T.clearBufferiv(T.COLOR,0,G)}else m|=T.COLOR_BUFFER_BIT}if(j)m|=T.DEPTH_BUFFER_BIT;if(l)m|=T.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);T.clear(m)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){J.removeEventListener("webglcontextlost",o,!1),J.removeEventListener("webglcontextrestored",$0,!1),J.removeEventListener("webglcontextcreationerror",k0,!1),L0.dispose(),J0.dispose(),s.dispose(),N0.dispose(),J1.dispose(),t0.dispose(),O.dispose(),I0.dispose(),A.dispose(),b.dispose(),_.dispose(),_.removeEventListener("sessionstart",q1),_.removeEventListener("sessionend",V1),C5.stop()};function o(L){L.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),V=!0}function $0(){console.log("THREE.WebGLRenderer: Context Restored."),V=!1;let L=d0.autoReset,j=E0.enabled,l=E0.autoUpdate,m=E0.needsUpdate,v=E0.type;n(),d0.autoReset=L,E0.enabled=j,E0.autoUpdate=l,E0.needsUpdate=m,E0.type=v}function k0(L){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",L.statusMessage)}function Q0(L){let j=L.target;j.removeEventListener("dispose",Q0),i(j)}function i(L){P0(L),N0.remove(L)}function P0(L){let j=N0.get(L).programs;if(j!==void 0){if(j.forEach(function(l){b.releaseProgram(l)}),L.isShaderMaterial)b.releaseShaderCache(L)}}this.renderBufferDirect=function(L,j,l,m,v,K0){if(j===null)j=y0;let G0=v.isMesh&&v.matrixWorld.determinant()<0,V0=WH(L,j,l,m,v);D0.setMaterial(m,G0);let F0=l.index,f0=1;if(m.wireframe===!0){if(F0=I.getWireframeAttribute(l),F0===void 0)return;f0=2}let j0=l.drawRange,A0=l.attributes.position,u0=j0.start*f0,Q1=(j0.start+j0.count)*f0;if(K0!==null)u0=Math.max(u0,K0.start*f0),Q1=Math.min(Q1,(K0.start+K0.count)*f0);if(F0!==null)u0=Math.max(u0,0),Q1=Math.min(Q1,F0.count);else if(A0!==void 0&&A0!==null)u0=Math.max(u0,0),Q1=Math.min(Q1,A0.count);let R1=Q1-u0;if(R1<0||R1===1/0)return;I0.setup(v,m,V0,l,F0);let k1,H1=H0;if(F0!==null)k1=W1.get(F0),H1=R0,H1.setIndex(k1);if(v.isMesh)if(m.wireframe===!0)D0.setLineWidth(m.wireframeLinewidth*_0()),H1.setMode(T.LINES);else H1.setMode(T.TRIANGLES);else if(v.isLine){let h0=m.linewidth;if(h0===void 0)h0=1;if(D0.setLineWidth(h0*_0()),v.isLineSegments)H1.setMode(T.LINES);else if(v.isLineLoop)H1.setMode(T.LINE_LOOP);else H1.setMode(T.LINE_STRIP)}else if(v.isPoints)H1.setMode(T.POINTS);else if(v.isSprite)H1.setMode(T.TRIANGLES);if(v.isBatchedMesh)if(v._multiDrawInstances!==null)o5("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),H1.renderMultiDrawInstances(v._multiDrawStarts,v._multiDrawCounts,v._multiDrawCount,v._multiDrawInstances);else if(!B0.get("WEBGL_multi_draw")){let{_multiDrawStarts:h0,_multiDrawCounts:w1,_multiDrawCount:a0}=v,b1=F0?W1.get(F0).bytesPerElement:1,R8=N0.get(m).currentProgram.getUniforms();for(let p1=0;p1<a0;p1++)R8.setValue(T,"_gl_DrawID",p1),H1.render(h0[p1]/b1,w1[p1])}else H1.renderMultiDraw(v._multiDrawStarts,v._multiDrawCounts,v._multiDrawCount);else if(v.isInstancedMesh)H1.renderInstances(u0,R1,v.count);else if(l.isInstancedBufferGeometry){let h0=l._maxInstanceCount!==void 0?l._maxInstanceCount:1/0,w1=Math.min(l.instanceCount,h0);H1.renderInstances(u0,R1,w1)}else H1.render(u0,R1)};function v0(L,j,l){if(L.transparent===!0&&L.side===u1&&L.forceSinglePass===!1)L.side=m1,L.needsUpdate=!0,S6(L,j,l),L.side=R5,L.needsUpdate=!0,S6(L,j,l),L.side=u1;else S6(L,j,l)}this.compile=function(L,j,l=null){if(l===null)l=L;if(Y=s.get(l),Y.init(j),B.push(Y),l.traverseVisible(function(v){if(v.isLight&&v.layers.test(j.layers)){if(Y.pushLight(v),v.castShadow)Y.pushShadow(v)}}),L!==l)L.traverseVisible(function(v){if(v.isLight&&v.layers.test(j.layers)){if(Y.pushLight(v),v.castShadow)Y.pushShadow(v)}});Y.setupLights();let m=new Set;return L.traverse(function(v){if(!(v.isMesh||v.isPoints||v.isLine||v.isSprite))return;let K0=v.material;if(K0)if(Array.isArray(K0))for(let G0=0;G0<K0.length;G0++){let V0=K0[G0];v0(V0,l,v),m.add(V0)}else v0(K0,l,v),m.add(K0)}),Y=B.pop(),m},this.compileAsync=function(L,j,l=null){let m=this.compile(L,j,l);return new Promise((v)=>{function K0(){if(m.forEach(function(G0){if(N0.get(G0).currentProgram.isReady())m.delete(G0)}),m.size===0){v(L);return}setTimeout(K0,10)}if(B0.get("KHR_parallel_shader_compile")!==null)K0();else setTimeout(K0,10)})};let s0=null;function o0(L){if(s0)s0(L)}function q1(){C5.stop()}function V1(){C5.start()}let C5=new RM;if(C5.setAnimationLoop(o0),typeof self<"u")C5.setContext(self);this.setAnimationLoop=function(L){s0=L,_.setAnimationLoop(L),L===null?C5.stop():C5.start()},_.addEventListener("sessionstart",q1),_.addEventListener("sessionend",V1),this.render=function(L,j){if(j!==void 0&&j.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(V===!0)return;if(L.matrixWorldAutoUpdate===!0)L.updateMatrixWorld();if(j.parent===null&&j.matrixWorldAutoUpdate===!0)j.updateMatrixWorld();if(_.enabled===!0&&_.isPresenting===!0){if(_.cameraAutoUpdate===!0)_.updateCamera(j);j=_.getCamera()}if(L.isScene===!0)L.onBeforeRender(D,L,j,z);if(Y=s.get(L,B.length),Y.init(j),B.push(Y),U0.multiplyMatrices(j.projectionMatrix,j.matrixWorldInverse),c0.setFromProjectionMatrix(U0,WJ,j.reversedDepth),M0=this.localClippingEnabled,p=O0.init(this.clippingPlanes,M0),q=J0.get(L,N.length),q.init(),N.push(q),_.enabled===!0&&_.isPresenting===!0){let K0=D.xr.getDepthSensingMesh();if(K0!==null)D5(K0,j,-1/0,D.sortObjects)}if(D5(L,j,0,D.sortObjects),q.finish(),D.sortObjects===!0)q.sort(g,W0);if(T0=_.enabled===!1||_.isPresenting===!1||_.hasDepthSensing()===!1,T0)L0.addToRenderList(q,L);if(this.info.render.frame++,p===!0)O0.beginShadows();let l=Y.state.shadowsArray;if(E0.render(l,L,j),p===!0)O0.endShadows();if(this.info.autoReset===!0)this.info.reset();let{opaque:m,transmissive:v}=q;if(Y.setupLights(),j.isArrayCamera){let K0=j.cameras;if(v.length>0)for(let G0=0,V0=K0.length;G0<V0;G0++){let F0=K0[G0];E7(m,v,L,F0)}if(T0)L0.render(L);for(let G0=0,V0=K0.length;G0<V0;G0++){let F0=K0[G0];k7(q,L,F0,F0.viewport)}}else{if(v.length>0)E7(m,v,L,j);if(T0)L0.render(L);k7(q,L,j)}if(z!==null&&C===0)q0.updateMultisampleRenderTarget(z),q0.updateRenderTargetMipmap(z);if(L.isScene===!0)L.onAfterRender(D,L,j);if(I0.resetDefaultState(),y=-1,P=null,B.pop(),B.length>0){if(Y=B[B.length-1],p===!0)O0.setGlobalState(D.clippingPlanes,Y.state.camera)}else Y=null;if(N.pop(),N.length>0)q=N[N.length-1];else q=null};function D5(L,j,l,m){if(L.visible===!1)return;if(L.layers.test(j.layers)){if(L.isGroup)l=L.renderOrder;else if(L.isLOD){if(L.autoUpdate===!0)L.update(j)}else if(L.isLight){if(Y.pushLight(L),L.castShadow)Y.pushShadow(L)}else if(L.isSprite){if(!L.frustumCulled||c0.intersectsSprite(L)){if(m)X0.setFromMatrixPosition(L.matrixWorld).applyMatrix4(U0);let G0=O.update(L),V0=L.material;if(V0.visible)q.push(L,G0,V0,l,X0.z,null)}}else if(L.isMesh||L.isLine||L.isPoints){if(!L.frustumCulled||c0.intersectsObject(L)){let G0=O.update(L),V0=L.material;if(m){if(L.boundingSphere!==void 0){if(L.boundingSphere===null)L.computeBoundingSphere();X0.copy(L.boundingSphere.center)}else{if(G0.boundingSphere===null)G0.computeBoundingSphere();X0.copy(G0.boundingSphere.center)}X0.applyMatrix4(L.matrixWorld).applyMatrix4(U0)}if(Array.isArray(V0)){let F0=G0.groups;for(let f0=0,j0=F0.length;f0<j0;f0++){let A0=F0[f0],u0=V0[A0.materialIndex];if(u0&&u0.visible)q.push(L,G0,u0,l,X0.z,A0)}}else if(V0.visible)q.push(L,G0,V0,l,X0.z,null)}}}let K0=L.children;for(let G0=0,V0=K0.length;G0<V0;G0++)D5(K0[G0],j,l,m)}function k7(L,j,l,m){let{opaque:v,transmissive:K0,transparent:G0}=L;if(Y.setupLightsView(l),p===!0)O0.setGlobalState(D.clippingPlanes,l);if(m)D0.viewport(F.copy(m));if(v.length>0)A6(v,j,l);if(K0.length>0)A6(K0,j,l);if(G0.length>0)A6(G0,j,l);D0.buffers.depth.setTest(!0),D0.buffers.depth.setMask(!0),D0.buffers.color.setMask(!0),D0.setPolygonOffset(!1)}function E7(L,j,l,m){if((l.isScene===!0?l.overrideMaterial:null)!==null)return;if(Y.state.transmissionRenderTarget[m.id]===void 0)Y.state.transmissionRenderTarget[m.id]=new $5(1,1,{generateMipmaps:!0,type:B0.has("EXT_color_buffer_half_float")||B0.has("EXT_color_buffer_float")?k6:U5,minFilter:A8,samples:4,stencilBuffer:H,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:i0.workingColorSpace});let K0=Y.state.transmissionRenderTarget[m.id],G0=m.viewport||F;K0.setSize(G0.z*D.transmissionResolutionScale,G0.w*D.transmissionResolutionScale);let V0=D.getRenderTarget(),F0=D.getActiveCubeFace(),f0=D.getActiveMipmapLevel();if(D.setRenderTarget(K0),D.getClearColor(x),c=D.getClearAlpha(),c<1)D.setClearColor(16777215,0.5);if(D.clear(),T0)L0.render(l);let j0=D.toneMapping;D.toneMapping=z5;let A0=m.viewport;if(m.viewport!==void 0)m.viewport=void 0;if(Y.setupLightsView(m),p===!0)O0.setGlobalState(D.clippingPlanes,m);if(A6(L,l,m),q0.updateMultisampleRenderTarget(K0),q0.updateRenderTargetMipmap(K0),B0.has("WEBGL_multisampled_render_to_texture")===!1){let u0=!1;for(let Q1=0,R1=j.length;Q1<R1;Q1++){let k1=j[Q1],H1=k1.object,h0=k1.geometry,w1=k1.material,a0=k1.group;if(w1.side===u1&&H1.layers.test(m.layers)){let b1=w1.side;w1.side=m1,w1.needsUpdate=!0,w7(H1,l,m,h0,w1,a0),w1.side=b1,w1.needsUpdate=!0,u0=!0}}if(u0===!0)q0.updateMultisampleRenderTarget(K0),q0.updateRenderTargetMipmap(K0)}if(D.setRenderTarget(V0,F0,f0),D.setClearColor(x,c),A0!==void 0)m.viewport=A0;D.toneMapping=j0}function A6(L,j,l){let m=j.isScene===!0?j.overrideMaterial:null;for(let v=0,K0=L.length;v<K0;v++){let G0=L[v],V0=G0.object,F0=G0.geometry,f0=G0.group,j0=G0.material;if(j0.allowOverride===!0&&m!==null)j0=m;if(V0.layers.test(l.layers))w7(V0,j,l,F0,j0,f0)}}function w7(L,j,l,m,v,K0){if(L.onBeforeRender(D,j,l,m,v,K0),L.modelViewMatrix.multiplyMatrices(l.matrixWorldInverse,L.matrixWorld),L.normalMatrix.getNormalMatrix(L.modelViewMatrix),v.onBeforeRender(D,j,l,m,L,K0),v.transparent===!0&&v.side===u1&&v.forceSinglePass===!1)v.side=m1,v.needsUpdate=!0,D.renderBufferDirect(l,j,m,v,L,K0),v.side=R5,v.needsUpdate=!0,D.renderBufferDirect(l,j,m,v,L,K0),v.side=u1;else D.renderBufferDirect(l,j,m,v,L,K0);L.onAfterRender(D,j,l,m,v,K0)}function S6(L,j,l){if(j.isScene!==!0)j=y0;let m=N0.get(L),v=Y.state.lights,K0=Y.state.shadowsArray,G0=v.state.version,V0=b.getParameters(L,v.state,K0,j,l),F0=b.getProgramCacheKey(V0),f0=m.programs;if(m.environment=L.isMeshStandardMaterial?j.environment:null,m.fog=j.fog,m.envMap=(L.isMeshStandardMaterial?t0:J1).get(L.envMap||m.environment),m.envMapRotation=m.environment!==null&&L.envMap===null?j.environmentRotation:L.envMapRotation,f0===void 0)L.addEventListener("dispose",Q0),f0=new Map,m.programs=f0;let j0=f0.get(F0);if(j0!==void 0){if(m.currentProgram===j0&&m.lightsStateVersion===G0)return R7(L,V0),j0}else V0.uniforms=b.getUniforms(L),L.onBeforeCompile(V0,D),j0=b.acquireProgram(V0,F0),f0.set(F0,j0),m.uniforms=V0.uniforms;let A0=m.uniforms;if(!L.isShaderMaterial&&!L.isRawShaderMaterial||L.clipping===!0)A0.clippingPlanes=O0.uniform;if(R7(L,V0),m.needsLights=EH(L),m.lightsStateVersion=G0,m.needsLights)A0.ambientLightColor.value=v.state.ambient,A0.lightProbe.value=v.state.probe,A0.directionalLights.value=v.state.directional,A0.directionalLightShadows.value=v.state.directionalShadow,A0.spotLights.value=v.state.spot,A0.spotLightShadows.value=v.state.spotShadow,A0.rectAreaLights.value=v.state.rectArea,A0.ltc_1.value=v.state.rectAreaLTC1,A0.ltc_2.value=v.state.rectAreaLTC2,A0.pointLights.value=v.state.point,A0.pointLightShadows.value=v.state.pointShadow,A0.hemisphereLights.value=v.state.hemi,A0.directionalShadowMap.value=v.state.directionalShadowMap,A0.directionalShadowMatrix.value=v.state.directionalShadowMatrix,A0.spotShadowMap.value=v.state.spotShadowMap,A0.spotLightMatrix.value=v.state.spotLightMatrix,A0.spotLightMap.value=v.state.spotLightMap,A0.pointShadowMap.value=v.state.pointShadowMap,A0.pointShadowMatrix.value=v.state.pointShadowMatrix;return m.currentProgram=j0,m.uniformsList=null,j0}function Z7(L){if(L.uniformsList===null){let j=L.currentProgram.getUniforms();L.uniformsList=D6.seqWithValue(j.seq,L.uniforms)}return L.uniformsList}function R7(L,j){let l=N0.get(L);l.outputColorSpace=j.outputColorSpace,l.batching=j.batching,l.batchingColor=j.batchingColor,l.instancing=j.instancing,l.instancingColor=j.instancingColor,l.instancingMorph=j.instancingMorph,l.skinning=j.skinning,l.morphTargets=j.morphTargets,l.morphNormals=j.morphNormals,l.morphColors=j.morphColors,l.morphTargetsCount=j.morphTargetsCount,l.numClippingPlanes=j.numClippingPlanes,l.numIntersection=j.numClipIntersection,l.vertexAlphas=j.vertexAlphas,l.vertexTangents=j.vertexTangents,l.toneMapping=j.toneMapping}function WH(L,j,l,m,v){if(j.isScene!==!0)j=y0;q0.resetTextureUnits();let K0=j.fog,G0=m.isMeshStandardMaterial?j.environment:null,V0=z===null?D.outputColorSpace:z.isXRRenderTarget===!0?z.texture.colorSpace:w6,F0=(m.isMeshStandardMaterial?t0:J1).get(m.envMap||G0),f0=m.vertexColors===!0&&!!l.attributes.color&&l.attributes.color.itemSize===4,j0=!!l.attributes.tangent&&(!!m.normalMap||m.anisotropy>0),A0=!!l.morphAttributes.position,u0=!!l.morphAttributes.normal,Q1=!!l.morphAttributes.color,R1=z5;if(m.toneMapped){if(z===null||z.isXRRenderTarget===!0)R1=D.toneMapping}let k1=l.morphAttributes.position||l.morphAttributes.normal||l.morphAttributes.color,H1=k1!==void 0?k1.length:0,h0=N0.get(m),w1=Y.state.lights;if(p===!0){if(M0===!0||L!==P){let _1=L===P&&m.id===y;O0.setState(m,L,_1)}}let a0=!1;if(m.version===h0.__version){if(h0.needsLights&&h0.lightsStateVersion!==w1.state.version)a0=!0;else if(h0.outputColorSpace!==V0)a0=!0;else if(v.isBatchedMesh&&h0.batching===!1)a0=!0;else if(!v.isBatchedMesh&&h0.batching===!0)a0=!0;else if(v.isBatchedMesh&&h0.batchingColor===!0&&v.colorTexture===null)a0=!0;else if(v.isBatchedMesh&&h0.batchingColor===!1&&v.colorTexture!==null)a0=!0;else if(v.isInstancedMesh&&h0.instancing===!1)a0=!0;else if(!v.isInstancedMesh&&h0.instancing===!0)a0=!0;else if(v.isSkinnedMesh&&h0.skinning===!1)a0=!0;else if(!v.isSkinnedMesh&&h0.skinning===!0)a0=!0;else if(v.isInstancedMesh&&h0.instancingColor===!0&&v.instanceColor===null)a0=!0;else if(v.isInstancedMesh&&h0.instancingColor===!1&&v.instanceColor!==null)a0=!0;else if(v.isInstancedMesh&&h0.instancingMorph===!0&&v.morphTexture===null)a0=!0;else if(v.isInstancedMesh&&h0.instancingMorph===!1&&v.morphTexture!==null)a0=!0;else if(h0.envMap!==F0)a0=!0;else if(m.fog===!0&&h0.fog!==K0)a0=!0;else if(h0.numClippingPlanes!==void 0&&(h0.numClippingPlanes!==O0.numPlanes||h0.numIntersection!==O0.numIntersection))a0=!0;else if(h0.vertexAlphas!==f0)a0=!0;else if(h0.vertexTangents!==j0)a0=!0;else if(h0.morphTargets!==A0)a0=!0;else if(h0.morphNormals!==u0)a0=!0;else if(h0.morphColors!==Q1)a0=!0;else if(h0.toneMapping!==R1)a0=!0;else if(h0.morphTargetsCount!==H1)a0=!0}else a0=!0,h0.__version=m.version;let b1=h0.currentProgram;if(a0===!0)b1=S6(m,j,v);let R8=!1,p1=!1,o8=!1,Z1=b1.getUniforms(),o1=h0.uniforms;if(D0.useProgram(b1.program))R8=!0,p1=!0,o8=!0;if(m.id!==y)y=m.id,p1=!0;if(R8||P!==L){if(D0.buffers.depth.getReversed()&&L.reversedDepth!==!0)L._reversedDepth=!0,L.updateProjectionMatrix();Z1.setValue(T,"projectionMatrix",L.projectionMatrix),Z1.setValue(T,"viewMatrix",L.matrixWorldInverse);let T1=Z1.map.cameraPosition;if(T1!==void 0)T1.setValue(T,Z0.setFromMatrixPosition(L.matrixWorld));if(p0.logarithmicDepthBuffer)Z1.setValue(T,"logDepthBufFC",2/(Math.log(L.far+1)/Math.LN2));if(m.isMeshPhongMaterial||m.isMeshToonMaterial||m.isMeshLambertMaterial||m.isMeshBasicMaterial||m.isMeshStandardMaterial||m.isShaderMaterial)Z1.setValue(T,"isOrthographic",L.isOrthographicCamera===!0);if(P!==L)P=L,p1=!0,o8=!0}if(v.isSkinnedMesh){Z1.setOptional(T,v,"bindMatrix"),Z1.setOptional(T,v,"bindMatrixInverse");let _1=v.skeleton;if(_1){if(_1.boneTexture===null)_1.computeBoneTexture();Z1.setValue(T,"boneTexture",_1.boneTexture,q0)}}if(v.isBatchedMesh){if(Z1.setOptional(T,v,"batchingTexture"),Z1.setValue(T,"batchingTexture",v._matricesTexture,q0),Z1.setOptional(T,v,"batchingIdTexture"),Z1.setValue(T,"batchingIdTexture",v._indirectTexture,q0),Z1.setOptional(T,v,"batchingColorTexture"),v._colorsTexture!==null)Z1.setValue(T,"batchingColorTexture",v._colorsTexture,q0)}let i1=l.morphAttributes;if(i1.position!==void 0||i1.normal!==void 0||i1.color!==void 0)S0.update(v,l,b1);if(p1||h0.receiveShadow!==v.receiveShadow)h0.receiveShadow=v.receiveShadow,Z1.setValue(T,"receiveShadow",v.receiveShadow);if(m.isMeshGouraudMaterial&&m.envMap!==null)o1.envMap.value=F0,o1.flipEnvMap.value=F0.isCubeTexture&&F0.isRenderTargetTexture===!1?-1:1;if(m.isMeshStandardMaterial&&m.envMap===null&&j.environment!==null)o1.envMapIntensity.value=j.environmentIntensity;if(p1){if(Z1.setValue(T,"toneMappingExposure",D.toneMappingExposure),h0.needsLights)kH(o1,o8);if(K0&&m.fog===!0)a.refreshFogUniforms(o1,K0);a.refreshMaterialUniforms(o1,m,e,d,Y.state.transmissionRenderTarget[L.id]),D6.upload(T,Z7(h0),o1,q0)}if(m.isShaderMaterial&&m.uniformsNeedUpdate===!0)D6.upload(T,Z7(h0),o1,q0),m.uniformsNeedUpdate=!1;if(m.isSpriteMaterial)Z1.setValue(T,"center",v.center);if(Z1.setValue(T,"modelViewMatrix",v.modelViewMatrix),Z1.setValue(T,"normalMatrix",v.normalMatrix),Z1.setValue(T,"modelMatrix",v.matrixWorld),m.isShaderMaterial||m.isRawShaderMaterial){let _1=m.uniformsGroups;for(let T1=0,i$=_1.length;T1<i$;T1++){let m5=_1[T1];A.update(m5,b1),A.bind(m5,b1)}}return b1}function kH(L,j){L.ambientLightColor.needsUpdate=j,L.lightProbe.needsUpdate=j,L.directionalLights.needsUpdate=j,L.directionalLightShadows.needsUpdate=j,L.pointLights.needsUpdate=j,L.pointLightShadows.needsUpdate=j,L.spotLights.needsUpdate=j,L.spotLightShadows.needsUpdate=j,L.rectAreaLights.needsUpdate=j,L.hemisphereLights.needsUpdate=j}function EH(L){return L.isMeshLambertMaterial||L.isMeshToonMaterial||L.isMeshPhongMaterial||L.isMeshStandardMaterial||L.isShadowMaterial||L.isShaderMaterial&&L.lights===!0}this.getActiveCubeFace=function(){return h},this.getActiveMipmapLevel=function(){return C},this.getRenderTarget=function(){return z},this.setRenderTargetTextures=function(L,j,l){let m=N0.get(L);if(m.__autoAllocateDepthBuffer=L.resolveDepthBuffer===!1,m.__autoAllocateDepthBuffer===!1)m.__useRenderToTexture=!1;N0.get(L.texture).__webglTexture=j,N0.get(L.depthTexture).__webglTexture=m.__autoAllocateDepthBuffer?void 0:l,m.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(L,j){let l=N0.get(L);l.__webglFramebuffer=j,l.__useDefaultFramebuffer=j===void 0};let wH=T.createFramebuffer();this.setRenderTarget=function(L,j=0,l=0){z=L,h=j,C=l;let m=!0,v=null,K0=!1,G0=!1;if(L){let F0=N0.get(L);if(F0.__useDefaultFramebuffer!==void 0)D0.bindFramebuffer(T.FRAMEBUFFER,null),m=!1;else if(F0.__webglFramebuffer===void 0)q0.setupRenderTarget(L);else if(F0.__hasExternalTextures)q0.rebindTextures(L,N0.get(L.texture).__webglTexture,N0.get(L.depthTexture).__webglTexture);else if(L.depthBuffer){let A0=L.depthTexture;if(F0.__boundDepthTexture!==A0){if(A0!==null&&N0.has(A0)&&(L.width!==A0.image.width||L.height!==A0.image.height))throw Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");q0.setupDepthRenderbuffer(L)}}let f0=L.texture;if(f0.isData3DTexture||f0.isDataArrayTexture||f0.isCompressedArrayTexture)G0=!0;let j0=N0.get(L).__webglFramebuffer;if(L.isWebGLCubeRenderTarget){if(Array.isArray(j0[j]))v=j0[j][l];else v=j0[j];K0=!0}else if(L.samples>0&&q0.useMultisampledRTT(L)===!1)v=N0.get(L).__webglMultisampledFramebuffer;else if(Array.isArray(j0))v=j0[l];else v=j0;F.copy(L.viewport),f.copy(L.scissor),u=L.scissorTest}else F.copy(w0).multiplyScalar(e).floor(),f.copy(z0).multiplyScalar(e).floor(),u=b0;if(l!==0)v=wH;if(D0.bindFramebuffer(T.FRAMEBUFFER,v)&&m)D0.drawBuffers(L,v);if(D0.viewport(F),D0.scissor(f),D0.setScissorTest(u),K0){let F0=N0.get(L.texture);T.framebufferTexture2D(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_CUBE_MAP_POSITIVE_X+j,F0.__webglTexture,l)}else if(G0){let F0=j;for(let f0=0;f0<L.textures.length;f0++){let j0=N0.get(L.textures[f0]);T.framebufferTextureLayer(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0+f0,j0.__webglTexture,l,F0)}}else if(L!==null&&l!==0){let F0=N0.get(L.texture);T.framebufferTexture2D(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_2D,F0.__webglTexture,l)}y=-1},this.readRenderTargetPixels=function(L,j,l,m,v,K0,G0,V0=0){if(!(L&&L.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let F0=N0.get(L).__webglFramebuffer;if(L.isWebGLCubeRenderTarget&&G0!==void 0)F0=F0[G0];if(F0){D0.bindFramebuffer(T.FRAMEBUFFER,F0);try{let f0=L.textures[V0],j0=f0.format,A0=f0.type;if(!p0.textureFormatReadable(j0)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!p0.textureTypeReadable(A0)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(j>=0&&j<=L.width-m&&(l>=0&&l<=L.height-v)){if(L.textures.length>1)T.readBuffer(T.COLOR_ATTACHMENT0+V0);T.readPixels(j,l,m,v,C0.convert(j0),C0.convert(A0),K0)}}finally{let f0=z!==null?N0.get(z).__webglFramebuffer:null;D0.bindFramebuffer(T.FRAMEBUFFER,f0)}}},this.readRenderTargetPixelsAsync=async function(L,j,l,m,v,K0,G0,V0=0){if(!(L&&L.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let F0=N0.get(L).__webglFramebuffer;if(L.isWebGLCubeRenderTarget&&G0!==void 0)F0=F0[G0];if(F0)if(j>=0&&j<=L.width-m&&(l>=0&&l<=L.height-v)){D0.bindFramebuffer(T.FRAMEBUFFER,F0);let f0=L.textures[V0],j0=f0.format,A0=f0.type;if(!p0.textureFormatReadable(j0))throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!p0.textureTypeReadable(A0))throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let u0=T.createBuffer();if(T.bindBuffer(T.PIXEL_PACK_BUFFER,u0),T.bufferData(T.PIXEL_PACK_BUFFER,K0.byteLength,T.STREAM_READ),L.textures.length>1)T.readBuffer(T.COLOR_ATTACHMENT0+V0);T.readPixels(j,l,m,v,C0.convert(j0),C0.convert(A0),0);let Q1=z!==null?N0.get(z).__webglFramebuffer:null;D0.bindFramebuffer(T.FRAMEBUFFER,Q1);let R1=T.fenceSync(T.SYNC_GPU_COMMANDS_COMPLETE,0);return T.flush(),await bQ(T,R1,4),T.bindBuffer(T.PIXEL_PACK_BUFFER,u0),T.getBufferSubData(T.PIXEL_PACK_BUFFER,0,K0),T.deleteBuffer(u0),T.deleteSync(R1),K0}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(L,j=null,l=0){let m=Math.pow(2,-l),v=Math.floor(L.image.width*m),K0=Math.floor(L.image.height*m),G0=j!==null?j.x:0,V0=j!==null?j.y:0;q0.setTexture2D(L,0),T.copyTexSubImage2D(T.TEXTURE_2D,l,0,0,G0,V0,v,K0),D0.unbindTexture()};let ZH=T.createFramebuffer(),RH=T.createFramebuffer();if(this.copyTextureToTexture=function(L,j,l=null,m=null,v=0,K0=null){if(K0===null)if(v!==0)o5("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),K0=v,v=0;else K0=0;let G0,V0,F0,f0,j0,A0,u0,Q1,R1,k1=L.isCompressedTexture?L.mipmaps[K0]:L.image;if(l!==null)G0=l.max.x-l.min.x,V0=l.max.y-l.min.y,F0=l.isBox3?l.max.z-l.min.z:1,f0=l.min.x,j0=l.min.y,A0=l.isBox3?l.min.z:0;else{let i1=Math.pow(2,-v);if(G0=Math.floor(k1.width*i1),V0=Math.floor(k1.height*i1),L.isDataArrayTexture)F0=k1.depth;else if(L.isData3DTexture)F0=Math.floor(k1.depth*i1);else F0=1;f0=0,j0=0,A0=0}if(m!==null)u0=m.x,Q1=m.y,R1=m.z;else u0=0,Q1=0,R1=0;let H1=C0.convert(j.format),h0=C0.convert(j.type),w1;if(j.isData3DTexture)q0.setTexture3D(j,0),w1=T.TEXTURE_3D;else if(j.isDataArrayTexture||j.isCompressedArrayTexture)q0.setTexture2DArray(j,0),w1=T.TEXTURE_2D_ARRAY;else q0.setTexture2D(j,0),w1=T.TEXTURE_2D;T.pixelStorei(T.UNPACK_FLIP_Y_WEBGL,j.flipY),T.pixelStorei(T.UNPACK_PREMULTIPLY_ALPHA_WEBGL,j.premultiplyAlpha),T.pixelStorei(T.UNPACK_ALIGNMENT,j.unpackAlignment);let a0=T.getParameter(T.UNPACK_ROW_LENGTH),b1=T.getParameter(T.UNPACK_IMAGE_HEIGHT),R8=T.getParameter(T.UNPACK_SKIP_PIXELS),p1=T.getParameter(T.UNPACK_SKIP_ROWS),o8=T.getParameter(T.UNPACK_SKIP_IMAGES);T.pixelStorei(T.UNPACK_ROW_LENGTH,k1.width),T.pixelStorei(T.UNPACK_IMAGE_HEIGHT,k1.height),T.pixelStorei(T.UNPACK_SKIP_PIXELS,f0),T.pixelStorei(T.UNPACK_SKIP_ROWS,j0),T.pixelStorei(T.UNPACK_SKIP_IMAGES,A0);let Z1=L.isDataArrayTexture||L.isData3DTexture,o1=j.isDataArrayTexture||j.isData3DTexture;if(L.isDepthTexture){let i1=N0.get(L),_1=N0.get(j),T1=N0.get(i1.__renderTarget),i$=N0.get(_1.__renderTarget);D0.bindFramebuffer(T.READ_FRAMEBUFFER,T1.__webglFramebuffer),D0.bindFramebuffer(T.DRAW_FRAMEBUFFER,i$.__webglFramebuffer);for(let m5=0;m5<F0;m5++){if(Z1)T.framebufferTextureLayer(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,N0.get(L).__webglTexture,v,A0+m5),T.framebufferTextureLayer(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,N0.get(j).__webglTexture,K0,R1+m5);T.blitFramebuffer(f0,j0,G0,V0,u0,Q1,G0,V0,T.DEPTH_BUFFER_BIT,T.NEAREST)}D0.bindFramebuffer(T.READ_FRAMEBUFFER,null),D0.bindFramebuffer(T.DRAW_FRAMEBUFFER,null)}else if(v!==0||L.isRenderTargetTexture||N0.has(L)){let i1=N0.get(L),_1=N0.get(j);D0.bindFramebuffer(T.READ_FRAMEBUFFER,ZH),D0.bindFramebuffer(T.DRAW_FRAMEBUFFER,RH);for(let T1=0;T1<F0;T1++){if(Z1)T.framebufferTextureLayer(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,i1.__webglTexture,v,A0+T1);else T.framebufferTexture2D(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_2D,i1.__webglTexture,v);if(o1)T.framebufferTextureLayer(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,_1.__webglTexture,K0,R1+T1);else T.framebufferTexture2D(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_2D,_1.__webglTexture,K0);if(v!==0)T.blitFramebuffer(f0,j0,G0,V0,u0,Q1,G0,V0,T.COLOR_BUFFER_BIT,T.NEAREST);else if(o1)T.copyTexSubImage3D(w1,K0,u0,Q1,R1+T1,f0,j0,G0,V0);else T.copyTexSubImage2D(w1,K0,u0,Q1,f0,j0,G0,V0)}D0.bindFramebuffer(T.READ_FRAMEBUFFER,null),D0.bindFramebuffer(T.DRAW_FRAMEBUFFER,null)}else if(o1)if(L.isDataTexture||L.isData3DTexture)T.texSubImage3D(w1,K0,u0,Q1,R1,G0,V0,F0,H1,h0,k1.data);else if(j.isCompressedArrayTexture)T.compressedTexSubImage3D(w1,K0,u0,Q1,R1,G0,V0,F0,H1,k1.data);else T.texSubImage3D(w1,K0,u0,Q1,R1,G0,V0,F0,H1,h0,k1);else if(L.isDataTexture)T.texSubImage2D(T.TEXTURE_2D,K0,u0,Q1,G0,V0,H1,h0,k1.data);else if(L.isCompressedTexture)T.compressedTexSubImage2D(T.TEXTURE_2D,K0,u0,Q1,k1.width,k1.height,H1,k1.data);else T.texSubImage2D(T.TEXTURE_2D,K0,u0,Q1,G0,V0,H1,h0,k1);if(T.pixelStorei(T.UNPACK_ROW_LENGTH,a0),T.pixelStorei(T.UNPACK_IMAGE_HEIGHT,b1),T.pixelStorei(T.UNPACK_SKIP_PIXELS,R8),T.pixelStorei(T.UNPACK_SKIP_ROWS,p1),T.pixelStorei(T.UNPACK_SKIP_IMAGES,o8),K0===0&&j.generateMipmaps)T.generateMipmap(w1);D0.unbindTexture()},this.copyTextureToTexture3D=function(L,j,l=null,m=null,v=0){return o5('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(L,j,l,m,v)},this.initRenderTarget=function(L){if(N0.get(L).__webglFramebuffer===void 0)q0.setupRenderTarget(L)},this.initTexture=function(L){if(L.isCubeTexture)q0.setTextureCube(L,0);else if(L.isData3DTexture)q0.setTexture3D(L,0);else if(L.isDataArrayTexture||L.isCompressedArrayTexture)q0.setTexture2DArray(L,0);else q0.setTexture2D(L,0);D0.unbindTexture()},this.resetState=function(){h=0,C=0,z=null,D0.reset(),I0.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return WJ}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace($){this._outputColorSpace=$;let J=this.getContext();J.drawingBufferColorSpace=i0._getDrawingBufferColorSpace($),J.unpackColorSpace=i0._getUnpackColorSpace()}}var h$={headsTall:7.5,height:1.7,shoulder:1,hip:1,limb:1},E8={headsTall:[6.5,9],height:[1.2,2.1],shoulder:[0.7,1.4],hip:[0.7,1.4],limb:[0.8,1.25]};function O6($){let J={...h$};if(!$)return J;for(let Q of Object.keys(E8)){let M=$[Q];if(typeof M==="number"&&Number.isFinite(M))J[Q]=Math.min(E8[Q][1],Math.max(E8[Q][0],M))}return J}var X5=["thumb","index","middle","ring","pinky"],L1=[],s1=[],lJ=[],r={},dJ=[];function z1($,J,Q){r[$]=L1.length,L1.push($),s1.push(J===null?-1:r[J]),lJ.push(Q)}z1("pelvis",null,0);z1("spine1","pelvis",0);z1("spine2","spine1",0);z1("spine3","spine2",0);z1("neck","spine3",0);z1("head","neck",0);for(let[$,J]of[["L",1],["R",2]]){z1(`clav${$}`,"spine3",J),z1(`shoulder${$}`,`clav${$}`,J),z1(`elbow${$}`,`shoulder${$}`,J),z1(`wrist${$}`,`elbow${$}`,J);for(let Q of X5)z1(`${Q}1${$}`,`wrist${$}`,J),z1(`${Q}2${$}`,`${Q}1${$}`,J),z1(`${Q}3${$}`,`${Q}2${$}`,J);z1(`hip${$}`,"pelvis",J),z1(`knee${$}`,`hip${$}`,J),z1(`ankle${$}`,`knee${$}`,J),z1(`toe${$}`,`ankle${$}`,J)}var X1=L1.length;for(let $=0;$<X1;$++){let J=L1[$];dJ.push(lJ[$]===0?$:r[J.slice(0,-1)+(lJ[$]===1?"R":"L")])}var x8=($)=>/^(thumb|index|middle|ring|pinky)\d/.test(L1[$]),y1=Math.PI/180,B5=new S(0,1,0),q6=new S(0,0,1),S$=new S(1,0,0),zM={thumb:{x:0.1,z:0.1,fan:42,len:[0.2,0.16,0.13],r:0.05},index:{x:0.46,z:0.13,fan:4,len:[0.17,0.1,0.082],r:0.04},middle:{x:0.47,z:0.04,fan:0,len:[0.19,0.115,0.088],r:0.042},ring:{x:0.45,z:-0.05,fan:-4,len:[0.175,0.105,0.082],r:0.039},pinky:{x:0.41,z:-0.135,fan:-10,len:[0.14,0.08,0.072],r:0.034}},BM=Object.fromEntries(Object.entries(zM).map(([$,J])=>[$,J.r]));function IM($,J){let Q=J.clone().normalize(),M=$.clone().addScaledVector(Q,-$.dot(Q)).normalize(),H=new S().crossVectors(M,Q);return{q:new m0().setFromRotationMatrix(new M1().makeBasis(M,Q,H)),x:M,y:Q,z:H}}function p5($,J,Q,M,H,K,W,k,E,w){let R=IM($,Q),Z=R.z.dot(J)<0,U=R.q;return{kind:"ball",F:U,Fi:U.clone().invert(),p1:M*y1,n1:H*y1,p2:(Z?W:K)*y1,n2:(Z?K:W)*y1,t0:k*y1,t1:E*y1,mirrored:w,zs:Z?-1:1}}function k8($,J,Q,M,H,K,W){let k=IM($,J);return{kind:"hinge",F:k.q,Fi:k.q.clone().invert(),lo:Q*y1,hi:M*y1,t0:H*y1,t1:K*y1,mirrored:W,axis:k.x}}function VM($){let J=O6($),Q=J.headsTall,M=J.limb,H=J.height/(3.9899999999999998+(Q-3.99)*M),K=(Q-3.99)*H*M,W=0.34*H,k=0.4*H*J.hip,E=0.82*H*J.shoulder,w=L1.map(()=>new S),R=L1.map(()=>null),Z=(D,V,h,C)=>w[r[D]].set(V,h,C);Z("pelvis",0,W+K+0.2*H,0),Z("spine1",0,0.45*H,0),Z("spine2",0,0.55*H,0),Z("spine3",0,0.55*H,0),Z("neck",0,0.55*H,0),Z("head",0,0.4*H,0.01*H),R[r.head]=new S(0,0.95*H,0);for(let[D,V]of[["L",1],["R",-1]]){Z(`clav${D}`,V*0.12*H,0.5*H,0.06*H),Z(`shoulder${D}`,V*(E-0.12*H),-0.1*H,-0.04*H),Z(`elbow${D}`,V*1.4*H*M,0,0),Z(`wrist${D}`,V*1.12*H*M,0,0);for(let h of X5){let C=zM[h],z=C.fan*y1,y=Math.cos(z),P=Math.sin(z);Z(`${h}1${D}`,V*C.x*H,0,C.z*H),Z(`${h}2${D}`,V*y*C.len[0]*H,0,P*C.len[0]*H),Z(`${h}3${D}`,V*y*C.len[1]*H,0,P*C.len[1]*H),R[r[`${h}3${D}`]]=new S(V*y*C.len[2]*H,0,P*C.len[2]*H)}Z(`hip${D}`,V*k,-0.2*H,0),Z(`knee${D}`,0,-0.53*K,0),Z(`ankle${D}`,0,-0.47*K,0),Z(`toe${D}`,0,-0.22*H,0.55*H),R[r[`toe${D}`]]=new S(0,-0.04*H,0.33*H)}let U=w.map((D,V)=>V===0?0:D.length()),X=w.map(()=>new S);for(let D=0;D<X1;D++)if(X[D].copy(w[D]),s1[D]>=0)X[D].add(X[s1[D]]);let G=L1.map(()=>new S(0,1,0)),q=(D,V)=>{let h=V?w[r[V]]:R[r[D]];if(h&&h.lengthSq()>0)G[r[D]].copy(h).normalize()};q("pelvis","spine1"),q("spine1","spine2"),q("spine2","spine3"),q("spine3","neck"),q("neck","head"),q("head",null);for(let D of["L","R"]){q(`clav${D}`,`shoulder${D}`),q(`shoulder${D}`,`elbow${D}`),q(`elbow${D}`,`wrist${D}`),q(`wrist${D}`,`middle1${D}`);for(let V of X5)q(`${V}1${D}`,`${V}2${D}`),q(`${V}2${D}`,`${V}3${D}`),q(`${V}3${D}`,null);q(`hip${D}`,`knee${D}`),q(`knee${D}`,`ankle${D}`),q(`ankle${D}`,`toe${D}`),q(`toe${D}`,null)}let Y=L1.map(()=>({kind:"free"})),N=new S(0,-1,0),B=(D,V,h,C,z)=>{Y[r[D]]=p5(q6,S$,B5,V,h,C,C,-z,z,!1)};B("spine1",28,15,15,15),B("spine2",25,15,15,15),B("spine3",25,15,15,15),B("neck",35,40,30,45),B("head",25,30,20,40);for(let D of["L","R"]){let V=D==="R",h=(z)=>{let y=G[r[z+D]].clone();return V?y.set(-y.x,y.y,y.z):y},C=(z,y)=>{Y[r[z+D]]=y};C("clav",p5(B5,q6,h("clav"),22,12,20,15,-10,10,V)),C("shoulder",p5(B5,q6,h("shoulder"),115,105,130,50,-85,85,V)),C("elbow",k8(new S(0,-1,0),h("elbow"),0,150,-130,15,V)),C("wrist",p5(B5,q6,h("wrist"),65,75,20,35,-15,15,V));for(let z of X5){let y=h(`${z}1`),P=h(`${z}2`),F=h(`${z}3`),f=(u)=>new S().crossVectors(u,N);if(z==="thumb")C(`${z}1`,p5(B5,new S().crossVectors(B5,y),y,20,50,35,35,-25,25,V)),C(`${z}2`,k8(f(P),P,-5,65,-4,4,V)),C(`${z}3`,k8(f(F),F,-10,85,-3,3,V));else C(`${z}1`,p5(B5,new S().crossVectors(B5,y),y,25,95,15,15,-6,6,V)),C(`${z}2`,k8(f(P),P,0,110,-3,3,V)),C(`${z}3`,k8(f(F),F,0,85,-3,3,V))}C("hip",p5(q6,S$,h("hip"),125,30,55,35,-45,40,V)),C("knee",k8(S$,h("knee"),0,150,-10,10,V)),C("ankle",p5(B5,S$,h("ankle"),25,50,15,15,-22,22,V)),C("toe",k8(new S(-1,0,0),h("toe"),-40,65,0,0,V))}return{props:J,h:H,off:w,len:U,rest:X,dir:G,tip:R,limits:Y,ankleY:W,legLen:K,hipHalf:k,shoulderHalf:E}}var x5=new m0,T$=new m0,N5=new m0;function mJ($,J,Q,M,H={t:0,sx:0,sz:0}){if(x5.copy(Q),M)x5.set(Q.x,-Q.y,-Q.z,Q.w);x5.premultiply(J).multiply($);let K=Math.hypot(x5.y,x5.w),W=0;if(K>0.000000001)W=2*Math.atan2(x5.y,x5.w);if(W>Math.PI)W-=2*Math.PI;if(W<-Math.PI)W+=2*Math.PI;if(T$.set(0,-Math.sin(W/2),0,Math.cos(W/2)),N5.copy(x5).multiply(T$),N5.w<0)N5.set(-N5.x,-N5.y,-N5.z,-N5.w);let k=Math.min(1,N5.w),E=2*Math.acos(k),w=Math.sin(E/2);if(H.t=W,w<0.000000001)H.sx=0,H.sz=0;else H.sx=N5.x/w*E,H.sz=N5.z/w*E;return H}var j1={t:0,sx:0,sz:0};function uJ($,J,Q,M,H,K,W){let k=Math.hypot(Q,M);if(k<0.000000000001)W.set(0,0,0,1);else{let E=Math.sin(k/2)/k;W.set(Q*E,0,M*E,Math.cos(k/2))}if(T$.set(0,Math.sin(H/2),0,Math.cos(H/2)),W.multiply(T$),W.premultiply($).multiply(J),K)W.set(W.x,-W.y,-W.z,W.w);return W.normalize()}function CM($,J,Q){let M=J>=0?$.p2:$.n2,H=Q>=0?$.n1:$.p1;return(J/M)**2+(Q/H)**2}function cJ($,J,Q){let M=$.limits[J];if(M.kind==="free")return 0;mJ(M.F,M.Fi,Q,M.mirrored,j1);let H=Math.max(0,M.t0-j1.t,j1.t-M.t1);if(M.kind==="hinge")return Math.max(H,Math.abs(j1.sz),Math.max(0,M.lo-j1.sx,j1.sx-M.hi));let K=CM(M,j1.sx,j1.sz);return Math.max(H,K>1?(Math.sqrt(K)-1)*Math.hypot(j1.sx,j1.sz):0)}function k5($,J,Q){let M=$.limits[J];if(M.kind==="free")return Q.normalize();mJ(M.F,M.Fi,Q,M.mirrored,j1);let{sx:H,sz:K,t:W}=j1;if(W=Math.min(M.t1,Math.max(M.t0,W)),M.kind==="hinge")H=Math.min(M.hi,Math.max(M.lo,H)),K=0;else{let k=CM(M,H,K);if(k>1){let E=1/Math.sqrt(k);H*=E,K*=E}}return uJ(M.F,M.Fi,H,K,W,M.mirrored,Q)}function _M($,J){let Q=$.limits[J],M=Q.axis.clone();return Q.mirrored?M.set(M.x,-M.y,-M.z):M}function AM($,J,Q){let M=$.limits[J];if(M.kind==="free")return 0;return mJ(M.F,M.Fi,Q,M.mirrored,j1),j1.t}function g5($,J,Q,M,H){let K=$.limits[J];return uJ(K.F,K.Fi,Q,0,M,K.mirrored,H)}function F6($,J,Q,M,H,K){let W=$.limits[J];if(W.kind!=="ball")return K.set(0,0,0,1);let k=W.zs;return uJ(W.F,W.Fi,k*M*y1,-Q*y1,H*y1,W.mirrored,K)}function f$($,J=$){return J.set($.x,-$.y,-$.z,$.w)}var v1=["footL","footR","handL","handR"];class L6{rig;q;rootP;rootQ=new m0;wp;wq;pins={footL:null,footR:null,handL:null,handR:null};constructor($){this.rig=VM($),this.q=this.rig.off.map(()=>new m0),this.wp=this.rig.off.map(()=>new S),this.wq=this.rig.off.map(()=>new m0),this.rootP=this.rig.rest[0].clone(),this.fk()}lowestY(){let $=1/0;for(let J of["ankleL","ankleR","toeL","toeR"])$=Math.min($,this.wp[r[J]].y);return $}setProps($){this.fk();let J=this.lowestY();this.rig=VM({...this.rig.props,...$}),this.fk(),this.rootP.y+=J-this.lowestY();for(let Q of v1)this.pins[Q]=null;this.fk()}fk($=0){let{off:J}=this.rig;if($===0)this.wq[0].copy(this.rootQ),this.wp[0].copy(this.rootP),$=1;for(let Q=$;Q<X1;Q++){let M=s1[Q];this.wq[Q].multiplyQuaternions(this.wq[M],this.q[Q]),this.wp[Q].copy(J[Q]).applyQuaternion(this.wq[M]).add(this.wp[M])}}clone(){let $=new L6(this.rig.props);return $.rig=this.rig,$.copyFrom(this),$}copyFrom($){this.rig=$.rig;for(let J=0;J<X1;J++)this.q[J].copy($.q[J]);this.rootP.copy($.rootP),this.rootQ.copy($.rootQ);for(let J of v1){let Q=$.pins[J];this.pins[J]=Q?{p:Q.p.clone(),q:Q.q.clone()}:null}this.fk()}jointWorld($){return this.wp[r[$]]}}var j$=0,SM=1,y$=2,v$=3,p$=4,E5=($)=>({i:[$,0,0,0],w:[1,0,0,0]}),TM=($,J,Q)=>({i:[$,J,0,0],w:[1-Q,Q,0,0]}),b$=($)=>{return $=Math.min(1,Math.max(0,$)),$*$*(3-2*$)};class hM{pos=[];nrm=[];si=[];sw=[];part=[];idx=[];grid($,J,Q,M,H){let K=this.pos.length/3,W=$.length,k=$[0].length,E=new Float32Array(W*k*3);for(let N=0;N<W;N++)for(let B=0;B<k;B++){let D=$[N][B];this.pos.push(D.x,D.y,D.z);let V=J[N];this.si.push(...V.i),this.sw.push(...V.w),this.part.push(Q)}let w=new S,R=new S,Z=new S,U=new S,X=new S,G=new S,q=(N,B,D)=>{this.idx.push(K+N,K+B,K+D),w.fromArray(this.pos,(K+N)*3),R.fromArray(this.pos,(K+B)*3),Z.fromArray(this.pos,(K+D)*3),G.crossVectors(U.subVectors(R,w),X.subVectors(Z,w));for(let V of[N,B,D])E[V*3]+=G.x,E[V*3+1]+=G.y,E[V*3+2]+=G.z};for(let N=0;N<W-1;N++)for(let B=0;B<k;B++){let D=(B+1)%k,V=N*k+B,h=N*k+D,C=(N+1)*k+B,z=(N+1)*k+D;q(V,h,C),q(h,z,C)}let Y=(N,B)=>{if(!B)return;for(let D=0;D<k;D++){let V=(N*k+D)*3;E[V]=B.x,E[V+1]=B.y,E[V+2]=B.z}};Y(0,M),Y(W-1,H);for(let N=0;N<W*k;N++)G.set(E[N*3],E[N*3+1],E[N*3+2]).normalize(),this.nrm.push(G.x,G.y,G.z)}tube($,J){let Q=J.capSteps??6,M=$[0],H=$[$.length-1],K=new S().subVectors($[1].c,M.c).normalize(),W=new S().subVectors(H.c,$[$.length-2].c).normalize(),k=[],E=[],w=(U,X,G,q)=>{let Y=J.u.clone().addScaledVector(X,-J.u.dot(X)).normalize(),N=new S().crossVectors(X,Y),B=[];for(let D=0;D<J.seg;D++){let V=D/J.seg*Math.PI*2;B.push(U.clone().addScaledVector(Y,G*Math.cos(V)).addScaledVector(N,q*Math.sin(V)))}return B};if(J.startCap)for(let U=0;U<Q;U++){let X=Math.PI/2*(1-U/Q),G=Math.cos(X),q=M.c.clone().addScaledVector(K,-J.startCap*Math.sin(X));k.push(w(q,K,M.rx*G,M.rz*G)),E.push(M.skin)}for(let U of $)k.push(w(U.c,U===M?K:U===H?W:K,U.rx,U.rz)),E.push(U.skin);if(J.endCap)for(let U=1;U<=Q;U++){let X=Math.PI/2*(U/Q),G=Math.cos(X),q=H.c.clone().addScaledVector(W,J.endCap*Math.sin(X));k.push(w(q,W,H.rx*G,H.rz*G)),E.push(H.skin)}let R=J.startCap?K.clone().negate():null,Z=J.endCap?W.clone():null;this.grid(k,E,J.part,R,Z)}geometry(){let $=new n1;return $.setAttribute("position",new N1(new Float32Array(this.pos),3)),$.setAttribute("normal",new N1(new Float32Array(this.nrm),3)),$.setAttribute("skinIndex",new N1(new Float32Array(this.si),4)),$.setAttribute("skinWeight",new N1(new Float32Array(this.sw),4)),$.setAttribute("part",new N1(new Float32Array(this.part),1)),$.setIndex(this.idx.length>65535?new N1(new Uint32Array(this.idx),1):new N1(new Uint16Array(this.idx),1)),$}}function qw($,J){let Q=Math.min($.length-1.0001,Math.max(0,J*($.length-1))),M=Math.floor(Q),H=Q-M;return $[M].map((K,W)=>K+($[M+1][W]-K)*H)}function Ow($,J){let Q=[],M=$.length;for(let H=0;H<J;H++){let K=H/(J-1)*(M-1),W=Math.min(M-2,Math.floor(K)),k=K-W,E=$[Math.max(0,W-1)],w=$[W],R=$[W+1],Z=$[Math.min(M-1,W+2)];Q.push(w.map((U,X)=>0.5*(2*w[X]+(-E[X]+R[X])*k+(2*E[X]-5*w[X]+4*R[X]-Z[X])*k*k+(-E[X]+3*w[X]-3*R[X]+Z[X])*k*k*k)))}return Q}function fM($){let J=new hM,Q=$.h,M=$.rest[0],H=new S(1,0,0),K=new S(0,0,1),{props:W}=$,k=1+(W.hip-1)*0.8,E=1+(W.shoulder-1)*0.6,w=Ow([[-0.44,0.1,0.1,0],[-0.34,0.5*k,0.4,-0.02],[-0.12,0.66*k,0.47,-0.03],[0.2,0.62*k,0.43,-0.03],[0.5,0.5,0.36,0],[0.95,0.55,0.39,0.02],[1.35,0.7*E,0.42,0.04],[1.7,0.75*E,0.4,0.03],[1.98,0.64*E,0.32,0],[2.16,0.32,0.24,0],[2.3,0.2,0.2,0]],44),R=[0,0.45,1,1.55,2.1],Z=[r.pelvis,r.spine1,r.spine2,r.spine3,r.neck],U=(z)=>{if(z<=R[0])return E5(Z[0]);if(z>=R[4])return E5(Z[4]);let y=0;while(z>R[y+1])y++;return TM(Z[y],Z[y+1],b$((z-R[y])/(R[y+1]-R[y])))};J.tube(w.map((z)=>({c:new S(0,M.y+z[0]*Q,z[3]*Q),rx:z[1]*Q,rz:z[2]*Q,skin:U(z[0])})),{u:H,seg:32,part:SM,capSteps:1});let X=$.rest[r.neck],G=$.rest[r.head],q=[];for(let z=0;z<=5;z++){let y=z/5;q.push({c:X.clone().lerp(G,y).add(new S(0,-0.1*Q*(1-y),0)),rx:(0.215-0.02*y)*Q,rz:(0.215-0.02*y)*Q,skin:TM(r.neck,r.head,b$((y-0.35)/0.65))})}J.tube(q,{u:H,seg:20,part:j$});let Y=$.rest[r.head].clone().add(new S(0,0.45*Q,0.03*Q)),N=E5(r.head),B=28,D=36,V=[],h=[];for(let z=0;z<=B;z++){let y=-Math.PI/2+z/B*Math.PI,P=Math.sin(y),F=Math.cos(y),f=P<0?1-0.32*b$(-P*1.1):1-0.06*P*P,u=[];for(let x=0;x<D;x++){let c=x/D*Math.PI*2,t=Math.cos(c)*F,d=-Math.sin(c)*F,e=d>=0?0.43:0.5,g=P<0&&d>0?0.04*b$(-P)*d:0;u.push(new S(Y.x+0.37*Q*t*f,Y.y+0.5*Q*P,Y.z+Q*(e*d*f+g)))}V.push(u),h.push(N)}J.grid(V,h,j$,new S(0,-1,0),new S(0,1,0));let C=(z,y,P,F,f,u,x=14,c=10)=>{let t=[],d=[];for(let e=0;e<=c;e++){let g=-Math.PI/2+e/c*Math.PI,W0=[];for(let w0=0;w0<x;w0++){let z0=w0/x*Math.PI*2;W0.push(new S(z.x+y*Math.cos(g)*Math.cos(z0),z.y+P*Math.sin(g),z.z-F*Math.cos(g)*Math.sin(z0)))}t.push(W0),d.push(u)}J.grid(t,d,f,new S(0,-1,0),new S(0,1,0))};C(Y.clone().add(new S(0,-0.06*Q,0.4*Q)),0.065*Q,0.1*Q,0.1*Q,j$,N,12,8);for(let z of[1,-1])C(Y.clone().add(new S(z*0.37*Q,-0.02*Q,-0.02*Q)),0.04*Q,0.1*Q,0.07*Q,j$,N,12,8);for(let[z,y]of[["L",1],["R",-1]]){let P=$.rest[r[`clav${z}`]],F=$.rest[r[`shoulder${z}`]];J.tube([{c:P,rx:0.15*Q,rz:0.15*Q,skin:E5(r[`clav${z}`])},{c:P.clone().lerp(F,0.5),rx:0.16*Q,rz:0.16*Q,skin:E5(r[`clav${z}`])},{c:F,rx:0.17*Q,rz:0.17*Q,skin:E5(r[`clav${z}`])}],{u:K,seg:16,part:SM,startCap:0.15*Q,endCap:0.17*Q});let f=(p,M0,U0,Z0,X0,y0,T0=20,_0=7,T=1)=>{let l0=$.rest[r[p+z]],B0=$.rest[r[M0+z]],p0=[];for(let d0=0;d0<_0;d0++){let N0=d0/(_0-1),q0=qw(U0,N0);p0.push({c:l0.clone().lerp(B0,N0),rx:q0[0]*Q,rz:(q0[1]??q0[0])*Q,skin:E5(r[p+z])})}let D0=p0[_0-1];J.tube(p0,{u:y0,seg:T0,part:Z0,startCap:X0?p0[0].rx:0,endCap:D0.rx*T})};f("shoulder","elbow",[[0.24],[0.215],[0.19],[0.17],[0.165]],y$,!0,K),f("elbow","wrist",[[0.165],[0.178],[0.16],[0.13],[0.105]],y$,!1,K),f("hip","knee",[[0.34],[0.325],[0.29],[0.245],[0.2]],v$,!0,H,24,8),f("knee","ankle",[[0.2],[0.215],[0.205],[0.15],[0.115]],v$,!1,H,22,8);let u=$.rest[r[`wrist${z}`]],x=new S(y,0,0),c=E5(r[`wrist${z}`]),t=[],d=[[0.12,0.085],[0.17,0.09],[0.205,0.085],[0.215,0.075],[0.21,0.065]];for(let p=0;p<d.length;p++){let M0=p/(d.length-1);t.push({c:u.clone().addScaledVector(x,(-0.04+M0*0.52)*Q).add(new S(0,0,0*Q)),rx:d[p][0]*Q,rz:d[p][1]*Q,skin:c})}J.tube(t,{u:K,seg:16,part:y$,startCap:0.06*Q,endCap:0.06*Q});for(let p of X5){let M0=BM[p]*Q*1.12,U0=r[`${p}1${z}`],Z0=r[`${p}2${z}`],X0=r[`${p}3${z}`],y0=$.rest[U0],T0=$.rest[Z0],_0=$.rest[X0],T=_0.clone().add($.tip[X0]);[[y0,T0,U0,M0*(p==="thumb"?1.12:1),M0*0.96],[T0,_0,Z0,M0*0.96,M0*0.9],[_0,T,X0,M0*0.9,M0*0.72]].forEach(([p0,D0,d0,N0,q0],J1)=>{let t0=[];for(let W1=0;W1<3;W1++){let I=W1/2,O=N0+(q0-N0)*I;t0.push({c:p0.clone().lerp(D0,I),rx:O,rz:O*0.92,skin:E5(d0)})}J.tube(t0,{u:new S(0,1,0),seg:10,part:y$,startCap:J1===0?N0:0,endCap:q0,capSteps:4})})}let e=$.rest[r[`ankle${z}`]],g=$.rest[r[`toe${z}`]],W0=E5(r[`ankle${z}`]),w0=E5(r[`toe${z}`]),b0=[[-0.3,0.13,0.12],[-0.2,0.17,0.155],[0,0.2,0.16],[0.2,0.15,0.17],[0.4,0.115,0.2],[0.55,0.098,0.215]].map(([p,M0,U0])=>({c:new S(e.x,M0*Q,e.z+p*Q),rx:U0*Q,rz:M0*Q,skin:W0}));b0[b0.length-1].c.copy(new S(g.x,0.098*Q,g.z)),J.tube(b0,{u:H,seg:20,part:v$,startCap:0.14*Q,endCap:0.1*Q});let c0=[[0.55,0.098,0.215],[0.72,0.075,0.195],[0.86,0.058,0.15]].map(([p,M0,U0])=>({c:new S(g.x,M0*Q,g.z+(p-0.55)*Q),rx:U0*Q,rz:M0*Q,skin:w0}));J.tube(c0,{u:H,seg:16,part:v$,endCap:0.06*Q})}return J.geometry()}function x$($,J){let{rest:Q}=$.rig,M=new S;for(let H=0;H<X1;H++){let K=J[H];K.makeRotationFromQuaternion($.wq[H]);let W=K.elements;M.copy(Q[H]).applyQuaternion($.wq[H]),W[12]=$.wp[H].x-M.x,W[13]=$.wp[H].y-M.y,W[14]=$.wp[H].z-M.z}}function jM($,J,Q){let M=$.getAttribute("position").array,H=$.getAttribute("skinIndex").array,K=$.getAttribute("skinWeight").array,W=M.length/3,k=Q&&Q.length===M.length?Q:new Float32Array(M.length);for(let E=0;E<W;E++){let w=M[E*3],R=M[E*3+1],Z=M[E*3+2],U=0,X=0,G=0;for(let q=0;q<4;q++){let Y=K[E*4+q];if(Y===0)continue;let N=J[H[E*4+q]].elements;U+=Y*(N[0]*w+N[4]*R+N[8]*Z+N[12]),X+=Y*(N[1]*w+N[5]*R+N[9]*Z+N[13]),G+=Y*(N[2]*w+N[6]*R+N[10]*Z+N[14])}k[E*3]=U,k[E*3+1]=X,k[E*3+2]=G}return k}var w8=[[255,90,60],[60,205,140],[80,140,255],[255,190,50]],yM=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];function Fw($){return[[[255,0,0],[0,255,0],[0,0,255],[255,255,0]],[[255,0,255],[0,255,255],[255,128,0],[128,0,255]],[[0,255,128],[255,0,128],[128,255,0],[0,128,255]],[[255,160,160],[160,255,160],[160,160,255],[255,255,160]]][$%4]}var vM=X1,g$=`
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute float part;
uniform mat4 uBones[${vM}];
varying vec3 vN;
varying vec3 vP;
varying float vPart;
varying float vD;
void main(){
  mat4 s = skinWeight.x*uBones[int(skinIndex.x+.5)] + skinWeight.y*uBones[int(skinIndex.y+.5)] + skinWeight.z*uBones[int(skinIndex.z+.5)] + skinWeight.w*uBones[int(skinIndex.w+.5)];
  vec4 wp = s*vec4(position,1.0);
  vP = wp.xyz;
  vN = mat3(s)*normal;
  vPart = part;
  vec4 mv = viewMatrix*wp;
  vD = -mv.z;
  gl_Position = projectionMatrix*mv;
}`,Lw=`
uniform vec3 uColor;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowOn;
uniform float uTexel;
uniform float uHi;
varying vec3 vN;
varying vec3 vP;
varying float vPart;
varying float vD;
float shadowAt(vec3 N, float ndl){
  vec4 lp = uShadowMat*vec4(vP + N*0.012, 1.0);
  vec3 c = lp.xyz*0.5+0.5;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.0;
  float bias = 0.0012 + 0.0025*(1.0-ndl);
  float lit = 0.0;
  for(int x=-1;x<=1;x++){
    for(int y=-1;y<=1;y++){
      float d = texture2D(uShadowMap, c.xy + vec2(float(x),float(y))*uTexel).r;
      lit += (c.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return lit/9.0;
}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float ndl = max(dot(N,uKeyDir),0.0);
  float sh = uShadowOn > 0.5 ? mix(0.18, 1.0, shadowAt(N, ndl)) : 1.0;
  float fd = max(dot(N,uFillDir),0.0);
  vec3 amb = mix(vec3(0.17,0.16,0.2), vec3(0.34,0.35,0.4), N.y*0.5+0.5);
  float tint = vPart < 0.5 ? 1.0 : (vPart < 1.5 ? 0.97 : (vPart < 2.5 ? 1.05 : 0.93));
  vec3 base = uColor*tint;
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N,H),0.0), 42.0)*0.2*ndl*sh;
  float rim = pow(1.0 - max(dot(N,V),0.0), 3.0);
  vec3 col = base*(amb + 0.82*ndl*sh + 0.3*fd*vec3(0.85,0.92,1.0)) + vec3(spec) + uHi*rim*0.35*vec3(0.6,1.0,0.9);
  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
}`,Pw=`
uniform vec3 uColor;
uniform vec3 uPartColors[${p$}];
uniform float uByPart;
varying float vPart;
void main(){
  vec3 c = uByPart > 0.5 ? uPartColors[int(vPart+0.5)] : uColor;
  gl_FragColor = vec4(c, 1.0);
}`,Vw=`
uniform float uNear;
uniform float uFar;
varying float vD;
void main(){
  float v = 1.0 - clamp((vD - uNear)/(uFar - uNear), 0.0, 1.0);
  gl_FragColor = vec4(vec3(v), 1.0);
}`,zw="void main(){ gl_FragColor = vec4(1.0); }",Bw=`
attribute vec4 skinIndex;
attribute vec4 skinWeight;
uniform mat4 uBones[${vM}];
uniform vec3 uShadowLight;
void main(){
  mat4 s = skinWeight.x*uBones[int(skinIndex.x+.5)] + skinWeight.y*uBones[int(skinIndex.y+.5)] + skinWeight.z*uBones[int(skinIndex.z+.5)] + skinWeight.w*uBones[int(skinIndex.w+.5)];
  vec4 wp = s*vec4(position,1.0);
  wp.xyz -= uShadowLight*(wp.y/uShadowLight.y);
  wp.y = 0.002;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`,Iw="void main(){ gl_FragColor = vec4(0.0,0.0,0.0,0.34); }",Cw=new S(-0.55,0.7,0.62).normalize(),_w=new S(0.75,-0.1,0.5).normalize();class nJ{canvas;renderer;scene=new P$;figs=new Map;shared;gridLines;shadowRT=null;exportRT=null;lightCam=new X6(-1,1,1,-1,0.1,10);exportCam=new F1;lost=!1;disposed=!1;shadowSize=1024;constructor($){this.canvas=$;this.renderer=new gJ({canvas:$,antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setClearColor(0,0),this.shared={uKeyDir:{value:new S(0,1,0)},uFillDir:{value:new S(1,0,0)},uShadowMap:{value:null},uShadowMat:{value:new M1},uShadowOn:{value:1},uTexel:{value:1/this.shadowSize},uNear:{value:1},uFar:{value:10},uShadowLight:{value:new S(-0.35,1,-0.2).normalize()}};let J=[],Q=3;for(let H=-Q*2;H<=Q*2;H++){let K=H*0.5;J.push(-Q,0,K,Q,0,K,K,0,-Q,K,0,Q)}let M=new n1;M.setAttribute("position",new l1(J,3)),this.gridLines=new z$(M,new Y6({color:3494220,transparent:!0,opacity:0.55})),this.gridLines.position.y=0.001,this.scene.add(this.gridLines)}makeFig($,J,Q){let M=fM(J.rig),H=Array.from({length:X1},()=>new M1),K={value:H},W={value:new S(1,1,1)},k={value:0},E={value:Array.from({length:p$},()=>new S)},w={value:0},R={uBones:K,uColor:W,uHi:k,uPartColors:E,uByPart:w,...this.shared},Z=(Y,N,B={})=>new J5({vertexShader:Y,fragmentShader:N,uniforms:R,...B}),U={shaded:Z(g$,Lw,{side:R5}),flat:Z(g$,Pw,{side:R5}),depth:Z(g$,Vw,{side:R5}),shadow:Z(g$,zw,{side:u1}),planar:Z(Bw,Iw,{transparent:!0,depthFunc:C8,depthWrite:!0,side:u1,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1})},X=new f1(M,U.shaded);X.frustumCulled=!1,X.matrixAutoUpdate=!1;let G=new f1(M,U.planar);G.frustumCulled=!1,G.matrixAutoUpdate=!1,G.renderOrder=-1,this.scene.add(X,G);let q={id:$,body:J,geo:M,mats:H,uBones:K,uColor:W,uHi:k,uPartColors:E,uByPart:w,mesh:X,shadowMesh:G,m:U,propsRef:J.rig,color:Q};return this.applyColor(q,Q),q}applyColor($,J){$.color=J;let Q=w8[J%w8.length];$.uColor.value.set(Q[0]/255,Q[1]/255,Q[2]/255)}disposeFig($){this.scene.remove($.mesh,$.shadowMesh),$.geo.dispose();for(let J of Object.values($.m))J.dispose()}sync($){let J=new Set($.map((Q)=>Q.id));for(let[Q,M]of this.figs)if(!J.has(Q))this.disposeFig(M),this.figs.delete(Q);for(let Q of $){let M=this.figs.get(Q.id);if(M&&(M.body!==Q.body||M.propsRef!==Q.body.rig))this.disposeFig(M),M=void 0;if(!M)M=this.makeFig(Q.id,Q.body,Q.color),this.figs.set(Q.id,M);if(M.color!==Q.color)this.applyColor(M,Q.color);x$(Q.body,M.mats)}}setSize($,J,Q){this.renderer.setPixelRatio(Q),this.renderer.setSize($,J,!1)}setLights($){this.shared.uKeyDir.value.copy(Cw).applyQuaternion($.quaternion),this.shared.uFillDir.value.copy(_w).applyQuaternion($.quaternion)}bounds(){let $=[];for(let Q of this.figs.values()){Q.body.fk();for(let M=0;M<X1;M++)$.push(Q.body.wp[M])}let J=new b5().setFromPoints($);return J.radius+=0.35,J}shadowPass(){if(!this.shadowRT){let H=new j8(this.shadowSize,this.shadowSize);H.minFilter=c1,H.magFilter=c1,this.shadowRT=new $5(this.shadowSize,this.shadowSize,{depthTexture:H,minFilter:c1,magFilter:c1})}let $=this.bounds(),J=this.shared.uKeyDir.value,Q=this.lightCam;if(Q.left=-$.radius,Q.right=$.radius,Q.top=$.radius,Q.bottom=-$.radius,Q.near=0.1,Q.far=$.radius*4,Q.position.copy($.center).addScaledVector(J,$.radius*2),Q.up.set(0,1,0),Math.abs(J.y)>0.98)Q.up.set(0,0,1);Q.lookAt($.center),Q.updateProjectionMatrix(),Q.updateMatrixWorld(),this.shared.uShadowMat.value.multiplyMatrices(Q.projectionMatrix,Q.matrixWorldInverse),this.shared.uShadowMap.value=this.shadowRT.depthTexture,this.shared.uTexel.value=1/this.shadowSize,this.gridLines.visible=!1;for(let H of this.figs.values())H.mesh.material=H.m.shadow,H.mesh.visible=!0,H.shadowMesh.visible=!1;let M=this.renderer;M.setRenderTarget(this.shadowRT),M.setClearColor(0,1),M.clear(!0,!0,!1),M.render(this.scene,Q),M.setRenderTarget(null)}renderView($,J){if(this.lost||this.disposed)return;let Q=this.renderer;if(this.setLights($),this.shared.uShadowOn.value=1,this.shadowPass(),Q.setClearColor(0,0),Q.clear(),this.gridLines.visible=J.grid,this.shared.uShadowLight.value.copy(this.shared.uKeyDir.value),this.shared.uShadowLight.value.y<0.25)this.shared.uShadowLight.value.y=0.25;this.shared.uShadowLight.value.normalize();for(let M of this.figs.values())M.mesh.material=M.m.shaded,M.mesh.visible=!0,M.shadowMesh.visible=J.shadow,M.uHi.value=J.selected===M.id?1:0,M.uByPart.value=0;Q.render(this.scene,$)}rt($,J,Q){let M=`${$}x${J}x${Q}`;if(this.exportRT&&this.exportRT.key!==M)this.exportRT.rt.dispose(),this.exportRT=null;if(!this.exportRT){let H=new $5($,J,{samples:Q,type:U5,format:e1,minFilter:c1,magFilter:c1,depthBuffer:!0});this.exportRT={key:M,rt:H}}return this.exportRT.rt}depthRange($){$.updateMatrixWorld();let J=$.matrixWorldInverse,Q=1/0,M=-1/0;for(let H of this.figs.values()){x$(H.body,H.mats);let K=jM(H.geo,H.mats),W=J.elements;for(let k=0;k<K.length;k+=3){let E=-(W[2]*K[k]+W[6]*K[k+1]+W[10]*K[k+2]+W[14]);if(E<Q)Q=E;if(E>M)M=E}}if(!Number.isFinite(Q))Q=1,M=2;return{near:Q,far:M}}renderMap($,J,Q,M,H={}){if(this.lost||this.disposed)throw Error("WebGL context lost");let K=this.renderer,W=this.rt(Q,M,$==="region"?0:4);this.setLights(J),this.gridLines.visible=!1;let k=[...this.figs.values()];for(let Z of k)x$(Z.body,Z.mats);if($==="mesh")this.shared.uShadowOn.value=1,this.shadowPass();if($==="depth"){let{near:Z,far:U}=this.depthRange(J),X=Math.max(0.02,(U-Z)*0.04);this.shared.uNear.value=Z-X,this.shared.uFar.value=U+X}k.forEach((Z,U)=>{if(Z.mesh.visible=!0,Z.shadowMesh.visible=!1,Z.uHi.value=0,Z.mesh.material=$==="mesh"?Z.m.shaded:$==="depth"?Z.m.depth:Z.m.flat,$==="region"){let X=H.regionMode==="parts";Z.uByPart.value=X?1:0;let G=yM[U%yM.length];Z.uColor.value.set(G[0]/255,G[1]/255,G[2]/255);let q=Fw(U);for(let Y=0;Y<p$;Y++)Z.uPartColors.value[Y].set(q[Y][0]/255,q[Y][1]/255,q[Y][2]/255)}}),K.setRenderTarget(W),K.setClearColor(0,1),K.clear(!0,!0,!0),K.render(this.scene,J);let E=new Uint8Array(Q*M*4);K.readRenderTargetPixels(W,0,0,Q,M,E),K.setRenderTarget(null),K.setClearColor(0,0);for(let Z of k){let U=w8[Z.color%w8.length];Z.uColor.value.set(U[0]/255,U[1]/255,U[2]/255),Z.uByPart.value=0}let w=new Uint8ClampedArray(Q*M*4),R=Q*4;for(let Z=0;Z<M;Z++)w.set(E.subarray((M-1-Z)*R,(M-Z)*R),Z*R);return new ImageData(w,Q,M)}dispose(){if(this.disposed)return;this.disposed=!0;for(let $ of this.figs.values())this.disposeFig($);this.figs.clear(),this.gridLines.geometry.dispose(),this.gridLines.material.dispose(),this.shadowRT?.depthTexture?.dispose(),this.shadowRT?.dispose(),this.exportRT?.rt.dispose(),this.shadowRT=null,this.exportRT=null,this.renderer.dispose(),this.renderer.forceContextLoss()}}function l$($,J,Q){let M=Q==="L"?1:-1,H=J==="arm";return{name:$,kind:J,clav:H?r[`clav${Q}`]:-1,root:r[`${H?"shoulder":"hip"}${Q}`],mid:r[`${H?"elbow":"knee"}${Q}`],end:r[`${H?"wrist":"ankle"}${Q}`],parent:H?r[`clav${Q}`]:r.pelvis,pole:H?new S(M*0.35,-0.45,-0.8):new S(M*0.1,0.05,1),pin:`${H?"hand":"foot"}${Q}`}}var w5={armL:l$("armL","arm","L"),armR:l$("armR","arm","R"),legL:l$("legL","leg","L"),legR:l$("legR","leg","R")},Z8={footL:w5.legL,footR:w5.legR,handL:w5.armL,handR:w5.armR},sJ=new WeakMap,P1=()=>new S,l8=P1(),d$=P1(),Aw=P1(),Sw=P1(),Tw=P1(),hw=P1(),l5=new m0,g8=new m0,pM=new m0,fw=new m0,jw=new M1,xM=new m0;function bM($,J,Q){let M=hw.crossVectors($,J);return Q.setFromRotationMatrix(jw.makeBasis($,J,M))}function P6($,J,Q){return Q.copy($).addScaledVector(J,-$.dot(J))}function yw($,J,Q=P1()){return Q.copy(J).applyQuaternion($.rootQ)}function vw($,J,Q){let{rig:M}=$,H=J.clav;l5.copy($.wq[s1[H]]).invert();let K=l8.subVectors(Q,$.wp[H]).normalize().applyQuaternion(l5),W=g8.setFromUnitVectors(M.dir[H],K);W.copy(xM).slerp(W,0.22),$.q[H].copy(k5(M,H,W)),$.fk(H)}function I5($,J,Q,M={}){let{rig:H}=$;if($.fk(),J.kind==="arm"&&M.assist!==!1)vw($,J,Q);let{root:K,mid:W,end:k}=J,E=l8.copy($.wp[K]).clone(),w=H.len[W],R=H.len[k],Z=d$.subVectors(Q,E),U=Z.length();if(U<0.000000001)Z.set(0,-1,0),U=0.000000001;let X=Z.clone().divideScalar(U),G=H.limits[W],q=w+R,Y=Math.sqrt(w*w+R*R+2*w*R*Math.cos(G.hi)),N=Math.min(q,Math.max(Y,U)),B=$.wp[W],V=$.wp[k].clone().sub(E).normalize(),h=sJ.get($)||{};sJ.set($,h);let C=P6(Aw.copy(B).sub(E),V,P1());if(C.lengthSq()>0.00000001)C.applyQuaternion(l5.setFromUnitVectors(V,X)).normalize();else if(h[J.name])C.copy(h[J.name]).applyQuaternion(l5.setFromUnitVectors(V,X)).normalize();let z=P6(yw($,M.pole??J.pole,P1()),X,P1()),y=z.length();if(y>0.000001)z.divideScalar(y);let P=P1();if(M.elbow)P6(Sw.copy(M.elbow).sub(E),X,P);else{if(C.lengthSq()>0.000000000001)P.copy(C);P.addScaledVector(z,M.spring??0.12)}if(P.lengthSq()<0.000000000001)if(y>0.000001)P.copy(z);else P.copy(Math.abs(X.y)<0.9?new S(0,1,0):new S(1,0,0));if(P6(P,X,P),P.lengthSq()<0.000000000001)P.set(X.z,X.x,X.y);P6(P,X,P).normalize();let F=new S().crossVectors(X,P),f=pM.copy($.wq[J.parent]).invert().clone(),u=H.dir[K],x=_M(H,W),c=bM(x,u,new m0).invert(),t=AM(H,W,$.q[W]),d=Math.max(-1,Math.min(1,(w*w+N*N-R*R)/(2*w*N))),e=Math.sqrt(1-d*d),g=X.clone().multiplyScalar(N).add(E),W0=P1(),w0=P1(),z0=P1(),b0=P1(),c0=new m0,p=new m0,M0=new m0,U0=(_0)=>{if(b0.copy(P).multiplyScalar(Math.cos(_0)).addScaledVector(F,Math.sin(_0)),W0.copy(X).multiplyScalar(d).addScaledVector(b0,e).normalize(),z0.copy(W0).multiplyScalar(-w).add(g).sub(E),w0.crossVectors(W0,z0),w0.length()<0.0000001*R)w0.crossVectors(W0,Tw.copy(b0).negate());w0.normalize(),c0.copy(f).multiply(bM(w0,W0,M0).multiply(c));let T=Math.acos(Math.max(-1,Math.min(1,W0.dot(z0)/Math.max(0.000000000001,z0.length()))));return g5(H,W,T,t,p),cJ(H,K,c0)+cJ(H,W,p)},Z0=Math.PI/45,X0=0,y0=U0(0),T0=y0<=0.00001;if(!T0){let _0=y0,T=0;for(let l0=1;l0<=45&&!T0;l0++)for(let B0 of[1,-1]){let p0=B0*l0*Z0,D0=U0(p0);if(D0<_0)_0=D0,T=p0;if(D0<=0.00001){let d0=B0*(l0-1)*Z0,N0=p0;for(let q0=0;q0<7;q0++){let J1=(d0+N0)/2;if(U0(J1)<=0.00001)N0=J1;else d0=J1}X0=N0,T0=!0;break}}if(!T0)X0=T,y0=_0}if(U0(X0),k5(H,K,c0),k5(H,W,p),$.q[K].copy(c0),$.q[W].copy(p),h[J.name]=(h[J.name]||P1()).copy(b0),$.fk(K),T0)y0=0;if(y0>0.00001)bw($,J,U<=q?Q:g,30);if(M.endQ)pw($,J,M.endQ);return $.wp[k].distanceTo(Q)}function bw($,J,Q,M){let{rig:H}=$;for(let K=0;K<M;K++){for(let W of[J.mid,J.root]){let k=$.wp[W],E=l8.subVectors($.wp[J.end],k),w=d$.subVectors(Q,k);if(E.lengthSq()<0.000000000001||w.lengthSq()<0.000000000001)continue;let R=l5.setFromUnitVectors(E.normalize(),w.normalize()),Z=g8.copy(R).multiply($.wq[W]),U=pM.copy($.wq[s1[W]]).invert().multiply(Z);$.q[W].copy(k5(H,W,U)),$.fk(W)}if($.wp[J.end].distanceToSquared(Q)<0.0000000001)break}}function pw($,J,Q){let M=fw.copy($.wq[J.mid]).invert().multiply(Q);$.q[J.end].copy(k5($.rig,J.end,M)),$.fk(J.end)}function m$($,J=P1()){return J.set(0,$.rig.h*0.45,0).applyQuaternion($.wq[r.head]).add($.wp[r.head])}function oJ($,J,Q,M,H,K={}){let{rig:W}=$,k=K.iters??24,E=K.tol??0.00001,w=P1(),R=()=>w.copy(M).applyQuaternion($.wq[Q]).add($.wp[Q]);$.fk();for(let Z=0;Z<k;Z++){for(let U=J.length-1;U>=0;U--){let X=J[U],G=$.wp[X],q=R(),Y=l8.subVectors(q,G),N=d$.subVectors(H,G);if(Y.lengthSq()<0.000000000001||N.lengthSq()<0.000000000001)continue;let B=l5.setFromUnitVectors(Y.normalize(),N.normalize()),D=K.weights?K.weights[U]:1;B.copy(xM).slerp(B,D).multiply($.wq[X]),g8.copy($.wq[s1[X]]).invert().multiply(B),$.q[X].copy(k5(W,X,g8)),$.fk(X)}if(R().distanceToSquared(H)<E*E)break}return R().distanceTo(H)}var gM=[r.spine1,r.spine2,r.spine3,r.neck],lM=[0.8,0.8,0.8,0.6],dM=[r.spine1,r.spine2];function mM($,J,Q,M){$.fk();let H=l8.subVectors($.wp[Q],$.wp[J]).normalize(),K=d$.subVectors(M,$.wp[J]).normalize(),W=l5.setFromUnitVectors(H,K).multiply($.wq[J]),k=g8.copy($.wq[s1[J]]).invert().multiply(W);$.q[J].copy(k5($.rig,J,k)),$.fk(J)}function uM($,J,Q){if($.fk(),J===0)$.rootQ.premultiply(Q).normalize();else{let M=l5.copy(Q).multiply($.wq[J]),H=g8.copy($.wq[s1[J]]).invert().multiply(M);$.q[J].copy(k5($.rig,J,H))}$.fk()}function cM($){$.fk();for(let J=0;J<4;J++){let Q=!1;for(let M of v1){let H=$.pins[M];if(!H)continue;let K=Z8[M],W=($.rig.len[K.mid]+$.rig.len[K.end])*0.998,k=l8.subVectors(H.p,$.wp[K.root]),E=k.length();if(E>W)$.rootP.addScaledVector(k.divideScalar(E),E-W),$.fk(),Q=!0}if(!Q)break}}function d8($,J){for(let Q of v1){let M=$.pins[Q];if(!M||Q===J)continue;I5($,Z8[Q],M.p,{endQ:M.q,assist:Z8[Q].kind==="arm"})}}function nM($,J,Q){if($.fk(),!Q){$.pins[J]=null;return}let M=Z8[J];$.pins[J]={p:$.wp[M.end].clone(),q:$.wq[M.end].clone()}}function sM($){sJ.delete($)}var iJ=["open","relaxed","fist","grip","point","spread"],M5=Math.PI/180,oM=($)=>[-$[0],$[1],$[2]],xw={open:{m:4,p:4,d:2,spread:0,thumb:[4,6,4]},relaxed:{m:16,p:24,d:14,spread:0,thumb:[10,12,12]},fist:{m:82,p:98,d:68,spread:0,thumb:[28,38,42]},grip:{m:62,p:80,d:52,spread:0,thumb:[30,30,34]},point:{m:4,p:4,d:2,spread:0,thumb:[10,14,14]},spread:{m:0,p:2,d:0,spread:11,thumb:[4,2,2]}};function u$($,J,Q){let{rig:M}=$,H=xw[Q];X5.forEach((K,W)=>{let k=r[`${K}1${J}`],E=r[`${K}2${J}`],w=r[`${K}3${J}`];if(K==="thumb"){let[G,q,Y]=H.thumb;F6(M,k,-G*0.8,0,0,$.q[k]),g5(M,E,q*M5,0,$.q[E]),g5(M,w,Y*M5,0,$.q[w]);return}let R=W-2.5,Z=H.m,U=H.p,X=H.d;if(Q==="point"&&K!=="index")Z=82,U=98,X=68;if(Q==="relaxed"){let G=1+(W-1)*0.12;Z*=G,U*=G,X*=G}F6(M,k,-Z,-R*H.spread*0.9,0,$.q[k]),g5(M,E,U*M5,0,$.q[E]),g5(M,w,X*M5,0,$.q[w]);for(let G of[k,E,w])k5(M,G,$.q[G])}),$.fk()}var aM={t:[1,-0.45,0.05],hand:"relaxed"},aJ={stand:{armL:aM,armR:"mirror"},relaxed:{root:{dy:-0.05,yaw:8,roll:3},spine:[3,-3,-4],neck:[4,3,-4],head:[4,0,-3],armL:{t:[0.95,-0.4,0.18],hand:"relaxed",wrist:[0,0,0]},armR:{t:[-0.8,-0.1,0.55],hand:"relaxed",twist:-20,pole:[-0.5,-0.6,-0.4]},legL:{t:[0.62,0.34,0.3],frame:"floor",foot:{yaw:12}},legR:{t:[-0.34,0.34,-0.2],frame:"floor",foot:{yaw:-14}}},walk:{root:{dy:-0.18,pitch:4},spine:[3,0,14],neck:[0,0,-6],head:[2,0,-5],armL:{t:[0.95,-0.75,-0.7],hand:"relaxed",pole:[0.3,0,-1]},armR:{t:[-0.95,-0.55,0.9],hand:"relaxed",pole:[-0.3,-0.6,-1]},legL:{t:[0.38,0.5,1.55],frame:"floor",foot:{pitch:-18}},legR:{t:[-0.38,0.85,-1.5],frame:"floor",foot:{pitch:48}}},run:{root:{dy:0.1,pitch:14},spine:[4,0,18],neck:[-6,0,-8],head:[-8,0,-6],armL:{t:[0.85,0.95,-0.4],hand:"fist",pole:[0.4,-0.4,-1],wrist:[0,0,0]},armR:{t:[-0.6,1.9,1.05],hand:"fist",pole:[-0.3,-1,0]},legL:{t:[0.42,1.55,1.25],frame:"floor",foot:{pitch:-8}},legR:{t:[-0.42,2,-2.1],frame:"floor",foot:{pitch:60}}},"sit on floor":{root:{y:0.52,pitch:-6},spine:[8,0,0],neck:[4,0,0],head:[-4,0,0],armL:{t:[0.6,0.1,1.45],hand:"relaxed",pole:[0.4,-0.4,-1],frame:"body"},armR:"mirror",legL:{t:[0.55,0.34,3.15],frame:"floor",pole:[0.1,1,0.2],foot:{pitch:-20,yaw:8}},legR:"mirror"},"sit on chair":{root:{y:2.55,pitch:3},spine:[4,0,0],neck:[2,0,0],head:[-3,0,0],armL:{t:[0.62,0.15,1.15],hand:"relaxed",pole:[0.5,-0.6,-1]},armR:"mirror",legL:{t:[0.5,0.34,1.95],frame:"floor",foot:{yaw:6}},legR:"mirror"},kneel:{root:{y:2.35,pitch:6,yaw:-12},spine:[4,0,8],neck:[4,0,0],head:[-2,0,0],armL:{t:[0.62,-0.5,1.5],hand:"relaxed",pole:[0.6,-0.8,-0.5]},armR:{t:[-0.75,-0.45,0.35],hand:"fist"},legL:{t:[0.5,0.34,2],frame:"floor",pole:[0.3,0.6,1]},legR:{t:[-0.45,0.34,-1.55],frame:"floor",pole:[-0.1,0.4,1],foot:{pitch:75}}},crouch:{root:{y:1.7,pitch:24},spine:[25,0,0],neck:[-12,0,0],head:[-18,0,0],armL:{t:[0.55,0.2,1.8],hand:"relaxed",pole:[0.4,-1,-0.3]},armR:"mirror",legL:{t:[0.8,0.34,0.6],frame:"floor",pole:[0.9,0.2,1],foot:{yaw:18}},legR:"mirror"},jump:{root:{y:5.35,pitch:-4},spine:[-4,0,0],neck:[-6,0,0],head:[-8,0,0],armL:{t:[1.7,4.5,0.3],hand:"spread",pole:[0.5,-0.4,-1]},armR:"mirror",legL:{t:[0.6,1.75,-0.5],frame:"floor",pole:[0.2,0.1,1],foot:{pitch:40}},legR:{t:[-0.45,1.35,0.55],frame:"floor",pole:[-0.2,0.1,1],foot:{pitch:30}}},"arms raised":{armL:{t:[1.3,4.5,0.2],hand:"open",pole:[0.4,-0.5,-1]},armR:"mirror",head:[-6,0,0]},"hands on hips":{armL:{t:[0.72,0.1,0.5],hand:"relaxed",pole:[1,0,-0.3],wrist:[-10,0,0],twist:-10},armR:"mirror"},"fighting stance":{root:{dy:-0.38,yaw:-35,pitch:8},spine:[6,0,-10],neck:[8,0,10],head:[6,0,8],armL:{t:[0.5,2.05,1.4],hand:"fist",pole:[0.2,-1,-0.2]},armR:{t:[-0.5,2.25,0.95],hand:"fist",pole:[-0.3,-1,-0.2]},legL:{t:[0.55,0.34,1.35],frame:"floor",pole:[0.3,0.2,1],foot:{yaw:-15}},legR:{t:[-0.55,0.34,-0.95],frame:"floor",pole:[-0.3,0.2,1],foot:{yaw:-40}}},"sword two-hand hold":{root:{dy:-0.22,yaw:-10},spine:[3,0,0],neck:[3,0,0],head:[0,0,0],armL:{t:[0.14,1.5,1.3],hand:"grip",pole:[0.8,-1,-0.3],wrist:[0,0,0]},armR:{t:[-0.1,1.05,1.2],hand:"grip",pole:[-0.8,-1,-0.3]},legL:{t:[0.6,0.34,0.6],frame:"floor",pole:[0.2,0.2,1],foot:{yaw:10}},legR:{t:[-0.5,0.34,-0.55],frame:"floor",pole:[-0.2,0.2,1],foot:{yaw:-20}}},"casting a spell with one arm extended":{root:{dy:-0.15,yaw:-14,roll:2},spine:[0,0,-12],neck:[-2,0,8],head:[0,0,10],armL:{t:[0.78,1.3,0.8],hand:"fist",pole:[0.8,-1,-0.5]},armR:{t:[-0.55,2.4,2.3],hand:"spread",pole:[-0.3,-1,0],twist:-80,wrist:[30,0,0]},legL:{t:[0.62,0.34,0.9],frame:"floor",pole:[0.1,0.2,1],foot:{yaw:8}},legR:{t:[-0.45,0.34,-0.7],frame:"floor",pole:[-0.1,0.2,1],foot:{yaw:-20}}},"reaching up":{root:{dy:0.08,pitch:-4},spine:[-6,0,4],neck:[-14,0,0],head:[-22,0,0],armR:{t:[-0.45,4.65,0.5],hand:"open",pole:[-0.3,-0.4,-1]},armL:{t:[1,-0.45,0.05],hand:"relaxed"},legL:{t:[0.4,0.62,0],frame:"floor",foot:{pitch:38}},legR:"mirror"},"lying down":{root:{y:0.55,pitch:-90},armL:{t:[1.05,-0.45,0.08],hand:"relaxed",twist:-10},armR:"mirror",legL:{t:[0.46,-3.62,0.05],frame:"body",foot:{yaw:10}},legR:"mirror"},"A-pose":{armL:{t:[2.6,0.15,0],hand:"open",twist:-20},armR:"mirror"},"T-pose":{armL:{t:[3.7,1.95,-0.04],hand:"open",twist:0},armR:"mirror"}},m8=Object.keys(aJ),rJ="stand";function rM($){return $.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}var gw=Object.fromEntries(m8.map(($)=>[rM($),$]));function c$($){return aJ[$]?$:gw[rM($)]||null}var iM=($)=>({...$,t:oM($.t),pole:$.pole?oM($.pole):void 0,foot:$.foot?{...$.foot,yaw:-($.foot.yaw??0),roll:-($.foot.roll??0)}:void 0});function lw($,J){let{rig:Q}=$,M=Q.h,H=$.rootP.x,K=$.rootP.z;for(let R of $.q)R.set(0,0,0,1);$.pins={footL:null,footR:null,handL:null,handR:null};let W=J.root||{};$.rootQ.setFromEuler(new d1((W.pitch??0)*M5,(W.yaw??0)*M5,(W.roll??0)*M5,"YXZ"));let k=new m0().setFromAxisAngle(new S(0,1,0),(W.yaw??0)*M5);$.rootP.set(H,W.y!==void 0?W.y*M:Q.rest[0].y+(W.dy??0)*M,K),sM($),$.fk();let E=(R,Z,U)=>{if(!U)return;R.forEach((X,G)=>F6(Q,X,U[0]*Z[G],U[1]*Z[G],U[2]*Z[G],$.q[X]))};E([r.spine1,r.spine2,r.spine3],[0.3,0.35,0.35],J.spine),E([r.neck],[1],J.neck),E([r.head],[1],J.head),$.fk();let w=(R,Z)=>{if(Z==="floor"){let U=new S(R[0]*M,0,R[2]*M).applyQuaternion(k);return new S($.rootP.x+U.x,R[1]*M,$.rootP.z+U.z)}return new S(R[0]*M,R[1]*M,R[2]*M).applyQuaternion($.rootQ).add($.rootP)};for(let R of["L","R"]){let Z=R==="L"?1:-1,U=J[`leg${R}`],G=(U==="mirror"?iM(J.legL):U)||{t:[Z*(Q.hipHalf/M),Q.ankleY/M,0],frame:"floor"},q=G.frame??"floor",Y=w(G.t,q),N=q==="floor"?k:$.rootQ,B=G.foot||{},D=N.clone().multiply(new m0().setFromEuler(new d1((B.pitch??0)*M5,(B.yaw??0)*M5,(B.roll??0)*M5,"YXZ"))),V=G.pole?new S(...G.pole):null;I5($,w5[`leg${R}`],Y,{pole:V,endQ:D,spring:0}),I5($,w5[`leg${R}`],Y,{pole:V,endQ:D,spring:0})}for(let R of["L","R"]){let Z=J[`arm${R}`],X=(Z==="mirror"?iM(J.armL):Z)||aM,G=R==="L"?X:X,q=r[`elbow${R}`];g5(Q,q,0,(G.twist??0)*M5,$.q[q]);let Y=w(G.t,"body"),N=G.pole?new S(...G.pole):null;I5($,w5[`arm${R}`],Y,{pole:N,spring:0}),I5($,w5[`arm${R}`],Y,{pole:N,spring:0});let B=G.wrist||[0,0,0];F6(Q,r[`wrist${R}`],B[0],B[1],B[2],$.q[r[`wrist${R}`]]),$.fk(),u$($,R,G.hand??"relaxed")}$.fk()}function V6($,J){let Q=c$(J);if(!Q)return!1;return lw($,aJ[Q]),!0}var c8=4,tM=100,u8=($)=>Math.round($*1e4)/1e4+0,tJ=($)=>Math.round($*1e5)/1e5+0,z6=($)=>Math.round($*1000)/1000+0;function eJ($){let J=$.w<0?-1:1,Q=Math.hypot($.x,$.y,$.z,$.w)||1;return[tJ($.x*J/Q),tJ($.y*J/Q),tJ($.z*J/Q)]}function $7($,J){if(!$||$.length<3||$.some((W)=>!Number.isFinite(W)))return J.set(0,0,0,1);let Q=$[0],M=$[1],H=$[2],K=Q*Q+M*M+H*H;if(K>1){let W=1/Math.sqrt(K);return J.set(Q*W,M*W,H*W,0)}return J.set(Q,M,H,Math.sqrt(1-K))}function eM($){let J=$.q.map((W)=>W.clone());for(let W=0;W<X1;W++)f$($.q[W].copy(J[dJ[W]]));f$($.rootQ);let Q=$.rootP.x,M=$.pins,H={footL:"footR",footR:"footL",handL:"handR",handR:"handL"},K={footL:null,footR:null,handL:null,handR:null};for(let W of v1){let k=M[W];if(!k)continue;K[H[W]]={p:new S(2*Q-k.p.x,k.p.y,k.p.z),q:f$(k.q.clone())}}$.pins=K,$.fk()}class n${persons=[];selected=0;nextId=1;undoStack=[];redoStack=[];pending=null;clipboard=null;constructor($=!0){if($)this.addPerson(!1)}get($){return this.persons.find((J)=>J.id===($??this.selected))||this.persons[0]||null}addPerson($=!0){if(this.persons.length>=c8)return null;if($)this.push();let J=new Set(this.persons.map((W)=>W.color)),Q=0;while(J.has(Q))Q++;let M=new L6(this.persons.length?this.persons[this.persons.length-1].body.rig.props:h$),H=this.nextId++,K=[0,0.95,-0.95,1.9];return M.rootP.x=K[this.persons.length]??0,V6(M,rJ),this.persons.push({id:H,color:Q,body:M}),this.selected=H,H}removePerson($){if(this.persons.length<=1)return!1;let J=this.persons.findIndex((Q)=>Q.id===$);if(J<0)return!1;if(this.push(),this.persons.splice(J,1),this.selected===$)this.selected=this.persons[Math.min(J,this.persons.length-1)].id;return!0}selectPerson($){if(!this.persons.some((J)=>J.id===$))return!1;return this.selected=$,!0}preset($,J){let Q=this.get(J);if(!Q)return!1;return this.push(),V6(Q.body,$)}resetPose($){let J=this.get($);if(!J)return;this.push(),V6(J.body,rJ)}mirror($){let J=this.get($);if(!J)return;this.push(),eM(J.body)}setProportions($,J){let Q=this.get(J);if(!Q)return;Q.body.setProps($)}copyPose($){let J=this.get($);if(!J)return;this.clipboard={q:J.body.q.map((Q)=>Q.clone()),rootQ:J.body.rootQ.clone(),y:J.body.rootP.y,props:J.body.rig.props}}pastePose($){let J=this.get($),Q=this.clipboard;if(!J||!Q)return!1;this.push();for(let M=0;M<X1;M++)J.body.q[M].copy(Q.q[M]);return J.body.rootQ.copy(Q.rootQ),J.body.rootP.y+=Q.y-J.body.rootP.y,J.body.pins={footL:null,footR:null,handL:null,handR:null},J.body.fk(),!0}snapshot(){return JSON.stringify(this.getPose())}push(){if(this.undoStack.push(this.snapshot()),this.undoStack.length>tM)this.undoStack.shift();this.redoStack.length=0}begin(){this.pending=this.snapshot()}end(){if(this.pending===null)return!1;let $=this.pending!==this.snapshot();if($){if(this.undoStack.push(this.pending),this.undoStack.length>tM)this.undoStack.shift();this.redoStack.length=0}return this.pending=null,$}undo(){let $=this.undoStack.pop();if($===void 0)return!1;return this.redoStack.push(this.snapshot()),this.restore($),!0}redo(){let $=this.redoStack.pop();if($===void 0)return!1;return this.undoStack.push(this.snapshot()),this.restore($),!0}restore($){let J=this.selected;if(this.setPose(JSON.parse($)),this.persons.some((Q)=>Q.id===J)&&!this.persons.some((Q)=>Q.id===this.selected))this.selected=J}getPose(){let $=this.persons.map(({id:J,color:Q,body:M})=>{let H={};for(let k=1;k<X1;k++){let E=eJ(M.q[k]);if(E[0]!==0||E[1]!==0||E[2]!==0)H[L1[k]]=E}let K={id:J,c:Q,p:[u8(M.rootP.x),u8(M.rootP.y),u8(M.rootP.z)],r:eJ(M.rootQ),j:H,pr:{h:z6(M.rig.props.headsTall),H:z6(M.rig.props.height),s:z6(M.rig.props.shoulder),w:z6(M.rig.props.hip),l:z6(M.rig.props.limb)}},W={};for(let k of v1){let E=M.pins[k];if(E)W[k]={p:[u8(E.p.x),u8(E.p.y),u8(E.p.z)],r:eJ(E.q)}}if(Object.keys(W).length)K.pin=W;return K});return{v:1,sel:this.selected,fig:$}}setPose($){let J=typeof $==="string"?JSON.parse($):$;if(!J||J.v!==1||!Array.isArray(J.fig)||J.fig.length===0)throw Error("Invalid pose data");let Q=[],M=0;for(let H of J.fig.slice(0,c8)){let K=new L6(O6({headsTall:H.pr?.h,height:H.pr?.H,shoulder:H.pr?.s,hip:H.pr?.w,limb:H.pr?.l})),W=H.p||[0,0,0];K.rootP.set(W[0]||0,W[1]||0,W[2]||0),$7(H.r,K.rootQ);for(let E=1;E<X1;E++){let w=H.j?.[L1[E]];if(w)$7(w,K.q[E])}for(let E of v1){let w=H.pin?.[E];if(w)K.pins[E]={p:new S(w.p[0],w.p[1],w.p[2]),q:$7(w.r,new m0)}}K.fk();let k=Number.isInteger(H.id)?H.id:Q.length+1;M=Math.max(M,k),Q.push({id:k,color:Number.isInteger(H.c)?Math.abs(H.c)%c8:Q.length,body:K})}this.persons=Q,this.nextId=Math.max(this.nextId,M+1),this.selected=Q.some((H)=>H.id===J.sel)?J.sel:Q[0].id}}function J7($){let J=JSON.stringify($);return(typeof btoa==="function"?btoa(unescape(encodeURIComponent(J))):Buffer.from(J).toString("base64")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}function B6($){let J=$.trim();if(J.startsWith("{"))return JSON.parse(J);let Q=J.replace(/-/g,"+").replace(/_/g,"/"),M=Q+"=".repeat((4-Q.length%4)%4),H=typeof atob==="function"?decodeURIComponent(escape(atob(M))):Buffer.from(M,"base64").toString();return JSON.parse(H)}var dw=[[5,7],[7,9],[6,8],[8,10],[11,13],[13,15],[12,14],[14,16],[5,6],[11,12],[5,11],[6,12],[0,5],[0,6]],$H=[[255,0,0],[255,128,0],[255,255,0],[128,255,0],[0,255,0],[0,255,128],[0,255,255],[0,128,255],[0,0,255],[128,0,255],[255,0,255],[255,0,128],[180,180,180],[220,220,220]],JH=[0,255,255],mw=[...$H,[255,255,255],JH,[0,0,0]],E1=($,J=0,Q=0,M=0)=>({j:$,o:new S(J,Q,M)}),I6=new S;function uw($){let J=$.rig.h,Q=r.head,M=[E1(Q,0,0.39*J,0.53*J),E1(Q,0.17*J,0.55*J,0.41*J),E1(Q,-0.17*J,0.55*J,0.41*J),E1(Q,0.38*J,0.43*J,0.01*J),E1(Q,-0.38*J,0.43*J,0.01*J),E1(r.shoulderL),E1(r.shoulderR),E1(r.elbowL),E1(r.elbowR),E1(r.wristL),E1(r.wristR),E1(r.hipL),E1(r.hipR),E1(r.kneeL),E1(r.kneeR),E1(r.ankleL),E1(r.ankleR)],H=[];for(let[W,k]of[["L",1],["R",-1]]){let E=$.rig.tip[r[`toe${W}`]];H.push(E1(r[`toe${W}`],-k*0.07*J,E.y,E.z),E1(r[`toe${W}`],k*0.12*J,-0.05*J,0.2*J),E1(r[`ankle${W}`],0,-0.21*J,-0.27*J))}let K=(W)=>{let k=[E1(r[`wrist${W}`])];for(let E of X5){k.push(E1(r[`${E}1${W}`]),E1(r[`${E}2${W}`]),E1(r[`${E}3${W}`]));let w=$.rig.tip[r[`${E}3${W}`]];k.push(E1(r[`${E}3${W}`],w.x,w.y,w.z))}return k};return{coco:M,feet:H,handL:K("L"),handR:K("R")}}function cw($,J,Q){I6.copy(J.o).applyQuaternion($.wq[J.j]).add($.wp[J.j]).project(Q);let M=(I6.x+1)/2,H=(1-I6.y)/2;if(I6.z>1||I6.z<-1)return{x:M,y:H,v:0};return{x:M,y:H,v:M>=0&&M<=1&&H>=0&&H<=1?2:1}}function Q7($,J,Q=0){$.fk(),J.updateMatrixWorld();let M=uw($),H=(K)=>K.map((W)=>cw($,W,J));return{id:Q,body:H(M.coco),feet:H(M.feet),handL:H(M.handL),handR:H(M.handR)}}function M7($,J,Q,M={}){let H=M.hands??!0,K=M.face??!0,W=M.scale??1,k=new Uint8ClampedArray(J*Q*4);for(let G=3;G<k.length;G+=4)k[G]=255;let E=(G,q,Y)=>{let N=(q*J+G)*4;k[N]=Y[0],k[N+1]=Y[1],k[N+2]=Y[2]},w=(G,q,Y,N)=>{let B=Math.max(0,Math.floor(G-Y)),D=Math.min(J-1,Math.ceil(G+Y)),V=Math.max(0,Math.floor(q-Y)),h=Math.min(Q-1,Math.ceil(q+Y)),C=Y*Y;for(let z=V;z<=h;z++)for(let y=B;y<=D;y++){let P=y+0.5-G,F=z+0.5-q;if(P*P+F*F<=C)E(y,z,N)}},R=(G,q,Y,N,B,D)=>{let V=B/2,h=Math.max(0,Math.floor(Math.min(G,Y)-V)),C=Math.min(J-1,Math.ceil(Math.max(G,Y)+V)),z=Math.max(0,Math.floor(Math.min(q,N)-V)),y=Math.min(Q-1,Math.ceil(Math.max(q,N)+V)),P=Y-G,F=N-q,f=P*P+F*F||0.000000001;for(let u=z;u<=y;u++)for(let x=h;x<=C;x++){let c=x+0.5-G,t=u+0.5-q,d=Math.max(0,Math.min(1,(c*P+t*F)/f)),e=c-d*P,g=t-d*F;if(e*e+g*g<=V*V)E(x,u,D)}},Z=Math.max(1,2*W),U=Math.max(1,3*W),X=Math.max(1,2*W);for(let G of $){dw.forEach(([q,Y],N)=>{let B=G.body[q],D=G.body[Y];if(B.v===0||D.v===0)return;R(B.x*J,B.y*Q,D.x*J,D.y*Q,Z,$H[N%14])}),G.body.forEach((q,Y)=>{if(q.v===0||!K&&Y>=1&&Y<=4)return;w(q.x*J,q.y*Q,U,[255,255,255])});for(let q of G.feet)if(q.v!==0)w(q.x*J,q.y*Q,X,[255,255,255]);if(H){for(let q of[G.handL,G.handR])for(let Y of q)if(Y.v!==0)w(Y.x*J,Y.y*Q,X,JH)}}return{data:k,width:J,height:Q}}var s$=[[1024,1024],[768,1024],[1024,768],[768,768],[640,1024],[1024,640],[832,1216],[1216,832],[896,1152],[1152,896],[512,512],[512,768],[768,512]],K7={front:{az:0,el:4},"3/4 left":{az:38,el:8},"3/4 right":{az:-38,el:8},side:{az:90,el:4},back:{az:180,el:4},top:{az:0,el:86},"low angle":{az:12,el:-24},"high angle":{az:12,el:36}},o$=Object.keys(K7),s8=["mesh","skeleton","depth","region"],G5={pelvis:"#ffb454",chest:"#d6a8ff",head:"#7ab8ff",hand:"#76dcc0",foot:"#76dcc0",elbow:"#f7e07a",knee:"#f7e07a",floor:"#9fb3ae",joint:"#e8f3f0"},H7=new S(0,1,0),C6=new S,n8=new S,QH=new m0,MH=new m0;class d5{container;model=new n$;listeners=new Map;root;canvas;overlay;ctx;msg;gpu=null;cam=new F1(35,1,0.05,100);view={az:0,el:4,dist:4.4,target:new S(0,0.9,0),fov:35};out=[768,1024];cw=1;ch=1;dpr=1;guide={x:0,y:0,w:1,h:1};dirty=!0;raf=0;mode="ik";depthMode=!1;showGrid=!0;showShadow=!0;showBones=!0;selJoint=null;handles=[];hover=null;pointers=new Map;drag=null;gesture=null;ro=null;destroyed=!1;changePending=!1;pixelRatioOpt;webgl=!0;ready=!1;onResizeBound=()=>this.resize();constructor($,J={}){this.container=$;this.root=document.createElement("div"),this.root.tabIndex=0,this.root.setAttribute("role","application"),this.root.setAttribute("aria-label","3D pose editor. Drag handles to pose the figure. Ctrl+Z undo, M mirror, R reset, 1 to 4 select figure."),Object.assign(this.root.style,{position:"relative",width:"100%",height:"100%",overflow:"hidden",touchAction:"none",outline:"none",userSelect:"none",background:"radial-gradient(ellipse at 50% 30%, #14201f 0%, #0a1011 70%)"}),this.canvas=document.createElement("canvas"),this.overlay=document.createElement("canvas");for(let Q of[this.canvas,this.overlay])Object.assign(Q.style,{position:"absolute",inset:"0",width:"100%",height:"100%",display:"block"});if(this.overlay.style.touchAction="none",this.msg=document.createElement("div"),Object.assign(this.msg.style,{position:"absolute",inset:"0",display:"none",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"24px",color:"#c8d9d5",font:"14px system-ui, sans-serif",background:"rgba(7,10,11,.9)"}),this.root.append(this.canvas,this.overlay,this.msg),$.appendChild(this.root),this.ctx=this.overlay.getContext("2d"),this.pixelRatioOpt=J.pixelRatio,J.width&&J.height)this.out=[J.width,J.height];if(J.fov)this.view.fov=J.fov;if(J.grid!==void 0)this.showGrid=J.grid;if(J.shadow!==void 0)this.showShadow=J.shadow;if(J.bones!==void 0)this.showBones=J.bones;if(J.mode)this.mode=J.mode;if(J.pose)try{this.model.setPose(typeof J.pose==="string"?B6(J.pose):J.pose)}catch(Q){this.emit("error",Q)}this.initGpu(),this.bind(),this.resize(),this.frameFigures(),this.ro=typeof ResizeObserver<"u"?new ResizeObserver(this.onResizeBound):null,this.ro?.observe(this.root),this.loop(),queueMicrotask(()=>{if(!this.destroyed)this.ready=!0,this.emit("ready"),this.emitState()})}initGpu(){try{if(!document.createElement("canvas").getContext("webgl2"))throw Error("WebGL2 is not available");this.gpu=new nJ(this.canvas),this.canvas.addEventListener("webglcontextlost",(J)=>{if(J.preventDefault(),this.gpu)this.gpu.lost=!0;this.showMessage("Graphics context lost. Restoring..."),this.emit("contextlost")}),this.canvas.addEventListener("webglcontextrestored",()=>{if(this.gpu)this.gpu.lost=!1;this.showMessage(""),this.dirty=!0,this.emit("contextrestored")})}catch($){this.webgl=!1,this.gpu=null,this.showMessage("3D preview needs WebGL2, which this browser or device does not provide. Pose data and the skeleton map still work. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled."),this.emit("error",$)}}showMessage($){this.msg.textContent=$,this.msg.style.display=$?"flex":"none"}on($,J){let Q=this.listeners.get($);if(!Q)this.listeners.set($,Q=new Set);if(Q.add(J),$==="ready"&&this.ready)queueMicrotask(()=>J());return()=>this.off($,J)}off($,J){this.listeners.get($)?.delete(J)}emit($,J){this.listeners.get($)?.forEach((Q)=>{try{Q(J)}catch{}})}emitState(){if(!this.ready)return;this.emit("state",this.getState())}changed(){if(this.dirty=!0,this.changePending)return;this.changePending=!0,requestAnimationFrame(()=>{if(this.changePending=!1,this.destroyed)return;this.emit("change",this.model.getPose()),this.emitState()})}getState(){let $=this.model.get(),J={footL:!1,footR:!1,handL:!1,handR:!1};if($)for(let Q of v1)J[Q]=!!$.body.pins[Q];return{people:this.model.persons.map((Q)=>({id:Q.id,color:Q.color})),selected:this.model.selected,mode:this.mode,pins:J,canUndo:this.model.undoStack.length>0,canRedo:this.model.redoStack.length>0,canPaste:!!this.model.clipboard,props:{...$?.body.rig.props},fov:this.view.fov,size:[...this.out],grid:this.showGrid,shadow:this.showShadow,bones:this.showBones,depthMode:this.depthMode,selectedJoint:this.selJoint===null?null:L1[this.selJoint],webgl:this.webgl}}sel(){return this.model.get()}setMode($){this.mode=$,this.selJoint=$==="fk"?this.selJoint:null,this.dirty=!0,this.emitState()}getMode(){return this.mode}setDepthMode($){this.depthMode=$,this.emitState()}setShowGrid($){this.showGrid=$,this.dirty=!0,this.emitState()}setShowShadow($){this.showShadow=$,this.dirty=!0,this.emitState()}setShowBones($){this.showBones=$,this.dirty=!0,this.emitState()}setOutputSize($,J){$=Math.max(16,Math.round($/16)*16),J=Math.max(16,Math.round(J/16)*16),this.out=[$,J],this.dirty=!0,this.emitState(),this.changed()}getOutputSize(){return[...this.out]}setFov($){this.view.fov=Math.min(90,Math.max(12,$)),this.dirty=!0,this.emitState(),this.changed()}addPerson(){let $=this.model.addPerson();if($!==null)this.selJoint=null,this.frameFigures(),this.changed(),this.emit("select",$);return $}removePerson($){let J=$??this.model.selected,Q=this.model.removePerson(J);if(Q)this.selJoint=null,this.changed(),this.emit("select",this.model.selected);return Q}selectPerson($){if(this.model.selected===$)return!0;let J=this.model.selectPerson($);if(J)this.selJoint=null,this.dirty=!0,this.emit("select",$),this.emitState();return J}selectIndex($){let J=this.model.persons[$];if(J)this.selectPerson(J.id)}getPeople(){return this.model.persons.map(($)=>({id:$.id,color:$.color,selected:$.id===this.model.selected}))}copyPose(){this.model.copyPose(),this.emitState()}pastePose(){if(this.model.pastePose())this.changed()}placePerson($,J,Q){let M=this.model.get($);if(!M)return;this.model.push();let H=M.body,K=J-H.rootP.x,W=Q-H.rootP.z;H.rootP.x=J,H.rootP.z=Q;for(let k of v1){let E=H.pins[k];if(E)E.p.x+=K,E.p.z+=W}H.fk(),this.changed()}setPreset($){if(!c$($))return!1;return this.model.preset($),this.changed(),!0}mirror(){this.model.mirror(),this.changed()}reset(){this.model.resetPose(),this.changed()}undo(){let $=this.model.undo();if($)this.selJoint=null,this.changed(),this.emit("select",this.model.selected);return $}redo(){let $=this.model.redo();if($)this.selJoint=null,this.changed(),this.emit("select",this.model.selected);return $}setProportions($){this.model.begin(),this.model.setProportions($),this.model.end(),this.changed()}previewProportions($){this.model.setProportions($),this.changed()}beginEdit(){this.model.begin()}endEdit(){if(this.model.end())this.emitState()}getProportions(){return{...this.sel().body.rig.props}}setHandShape($,J){this.model.push();let Q=this.sel().body;if($!=="R")u$(Q,"L",J);if($!=="L")u$(Q,"R",J);this.changed()}togglePin($){let J=this.sel().body;this.model.push(),nM(J,$,!J.pins[$]),this.changed()}setCameraView($){let J=K7[$];if(!J)return!1;return this.view.az=J.az*Math.PI/180,this.view.el=J.el*Math.PI/180,this.frameFigures(),this.changed(),!0}frameFigures(){let $=[];for(let V of this.model.persons){V.body.fk();for(let h=0;h<X1;h++)if(!x8(h)||/1[LR]$/.test(L1[h]))$.push(V.body.wp[h])}let{az:J,el:Q}=this.view,M=Math.cos(Q),H=new S(Math.sin(J)*M,Math.sin(Q),Math.cos(J)*M),K=new S().crossVectors(H7,H).normalize(),W=new S().crossVectors(H,K).normalize(),k=1/0,E=-1/0,w=1/0,R=-1/0;for(let V of $){let h=V.dot(K),C=V.dot(W);k=Math.min(k,h),E=Math.max(E,h),w=Math.min(w,C),R=Math.max(R,C)}let Z=0.2;k-=Z,E+=Z,w-=Z,R+=Z;let U=(k+E)/2,X=(w+R)/2,G=$.reduce((V,h)=>V+h.dot(H),0)/$.length,q=K.clone().multiplyScalar(U).addScaledVector(W,X).addScaledVector(H,G),Y=this.out[0]/this.out[1],N=Math.tan(this.view.fov*Math.PI/360),B=N*Y,D=0.8;for(let V of $){let h=V.clone().sub(q),C=h.dot(H),z=Math.max(Math.abs(h.dot(K))+Z,0)/B+C,y=(Math.abs(h.dot(W))+Z)/N+C;D=Math.max(D,z,y)}this.view.target.copy(q),this.view.dist=Math.min(30,D*1.04),this.dirty=!0}updateCamera(){let{az:$,el:J,dist:Q,target:M}=this.view,H=Math.cos(J);this.cam.position.set(M.x+Q*Math.sin($)*H,M.y+Q*Math.sin(J),M.z+Q*Math.cos($)*H),this.cam.up.copy(H7),this.cam.lookAt(M);let K=this.out[0]/this.out[1],W=Math.min(this.ch*0.92,this.cw*0.94/K),k=W*K;this.guide={x:(this.cw-k)/2,y:(this.ch-W)/2,w:k,h:W},this.cam.fov=2*Math.atan(Math.tan(this.view.fov*Math.PI/360)*this.ch/W)*180/Math.PI,this.cam.aspect=this.cw/this.ch,this.cam.near=0.05,this.cam.far=120,this.cam.updateProjectionMatrix(),this.cam.updateMatrixWorld()}resize(){let $=this.root.getBoundingClientRect();this.cw=Math.max(1,Math.floor($.width)),this.ch=Math.max(1,Math.floor($.height)),this.dpr=this.pixelRatioOpt??Math.min(2,window.devicePixelRatio||1),this.gpu?.setSize(this.cw,this.ch,this.dpr),this.overlay.width=Math.round(this.cw*this.dpr),this.overlay.height=Math.round(this.ch*this.dpr),this.dirty=!0}loop=()=>{if(this.destroyed)return;if(this.raf=requestAnimationFrame(this.loop),!this.dirty)return;this.dirty=!1,this.render()};render(){this.updateCamera();let $=this.gpu;if($&&!$.lost)$.sync(this.model.persons.map((J)=>({id:J.id,body:J.body,color:J.color}))),$.renderView(this.cam,{grid:this.showGrid,shadow:this.showShadow,selected:this.model.persons.length>1?this.model.selected:null,dim:!1});this.drawOverlay()}requestRender(){this.dirty=!0}project($,J={x:0,y:0,z:0}){return n8.copy($).project(this.cam),J.x=(n8.x+1)/2*this.cw,J.y=(1-n8.y)/2*this.ch,J.z=n8.z,J}computeHandles(){let $=this.model.get();if(!$)return[];let J=$.body;J.fk();let Q=[];if(this.mode==="ik"){Q.push({kind:"pelvis",id:"pelvis",pos:J.wp[r.pelvis].clone(),r:9,color:G5.pelvis}),Q.push({kind:"chest",id:"chest",pos:J.wp[r.spine3].clone(),r:7,color:G5.chest}),Q.push({kind:"head",id:"head",pos:m$(J),r:9,color:G5.head});for(let K of["L","R"])Q.push({kind:"hand",id:`hand${K}`,pos:J.wp[r[`wrist${K}`]].clone(),r:8,color:G5.hand}),Q.push({kind:"foot",id:`foot${K}`,pos:J.wp[r[`ankle${K}`]].clone(),r:8,color:G5.foot}),Q.push({kind:"elbow",id:`elbow${K}`,pos:J.wp[r[`elbow${K}`]].clone(),r:6,color:G5.elbow}),Q.push({kind:"knee",id:`knee${K}`,pos:J.wp[r[`knee${K}`]].clone(),r:6,color:G5.knee});let M=(J.wp[r.ankleL].x+J.wp[r.ankleR].x)/2,H=(J.wp[r.ankleL].z+J.wp[r.ankleR].z)/2;Q.push({kind:"floor",id:"floor",pos:new S(M,0,H),r:8,color:G5.floor})}else{let M=this.selJoint!==null&&(x8(this.selJoint)||/^wrist/.test(L1[this.selJoint])),H=this.selJoint!==null?L1[this.selJoint].slice(-1):"";for(let K=0;K<X1;K++)if(x8(K)){if(!M||L1[K].slice(-1)!==H)continue;Q.push({kind:"joint",id:`j${K}`,pos:J.wp[K].clone(),r:4,color:G5.joint,joint:K})}else Q.push({kind:"joint",id:`j${K}`,pos:J.wp[K].clone(),r:K===0?8:6,color:G5.joint,joint:K})}return Q}drawOverlay(){let $=this.ctx,{dpr:J,cw:Q,ch:M}=this;$.setTransform(J,0,0,J,0,0),$.clearRect(0,0,Q,M);let H=this.guide;$.fillStyle="rgba(4,8,9,0.5)",$.beginPath(),$.rect(0,0,Q,M),$.rect(H.x,H.y,H.w,H.h),$.fill("evenodd"),$.strokeStyle="rgba(118,220,192,0.55)",$.lineWidth=1,$.setLineDash([6,5]),$.strokeRect(H.x+0.5,H.y+0.5,H.w-1,H.h-1),$.setLineDash([]),$.fillStyle="rgba(118,220,192,0.75)",$.font="11px ui-monospace, monospace",$.textBaseline="bottom",$.fillText(`${this.out[0]}×${this.out[1]}`,H.x+6,H.y+H.h-5);let K=this.model.get(),W={x:0,y:0,z:0};if(this.showBones&&K){let E=K.body;$.lineWidth=1.5,$.strokeStyle="rgba(232,243,240,0.28)",$.beginPath();for(let w=1;w<X1;w++){if(x8(w))continue;let R=s1[w];this.project(E.wp[R],W),$.moveTo(W.x,W.y),this.project(E.wp[w],W),$.lineTo(W.x,W.y)}$.stroke()}if(this.model.persons.length>1)this.model.persons.forEach((E,w)=>{let R=m$(E.body,new S).add(new S(0,E.body.rig.h*0.8,0));this.project(R,W);let Z=E.id===this.model.selected;$.fillStyle=Z?"#8ee4ca":"rgba(20,32,31,0.9)",$.strokeStyle=Z?"#8ee4ca":"rgba(142,228,202,0.5)",$.lineWidth=1.5,$.beginPath(),$.arc(W.x,W.y,11,0,Math.PI*2),$.fill(),$.stroke(),$.fillStyle=Z?"#06120f":"#c8d9d5",$.font="700 12px system-ui, sans-serif",$.textAlign="center",$.textBaseline="middle",$.fillText(String(w+1),W.x,W.y+0.5)}),$.textAlign="start";this.handles=this.computeHandles();let k=this.drag?.handle.id??null;for(let E of this.handles){this.project(E.pos,W);let R=k===E.id||this.hover===E.id||E.joint!==void 0&&E.joint===this.selJoint,Z=E.kind==="hand"||E.kind==="foot"?E.id:null,U=Z&&K?.body.pins[Z];if(E.kind==="floor"){$.strokeStyle=E.color,$.lineWidth=R?2.5:1.5,$.beginPath(),$.ellipse(W.x,W.y,22,8,0,0,Math.PI*2),$.stroke();continue}if($.fillStyle=R?"#ffffff":E.color,$.strokeStyle="rgba(5,9,10,0.85)",$.lineWidth=2,$.beginPath(),$.arc(W.x,W.y,E.r+(R?2:0),0,Math.PI*2),$.fill(),$.stroke(),U)$.strokeStyle="#ff6b6b",$.lineWidth=2,$.beginPath(),$.arc(W.x,W.y,E.r+5,0,Math.PI*2),$.stroke()}}hitRadius($){return $?26:16}pick($,J,Q){let M=null,H=1/0,K={x:0,y:0,z:0},W=this.hitRadius(Q);for(let k of this.handles){this.project(k.pos,K);let E=Math.hypot(K.x-$,K.y-J);if(k.kind==="floor")E=Math.hypot((K.x-$)/2.4,K.y-J);let w=k.kind==="floor"?W:W+(k.r>7?2:0),R=k.kind==="elbow"||k.kind==="knee"||k.kind==="chest"?1.15:k.kind==="floor"?1.6:1;if(E<=w&&E*R<H)H=E*R,M=k}return M}pickPerson($,J,Q){let M={x:0,y:0,z:0},H=Q?22:15;if(this.model.persons.length>1)for(let k of this.model.persons){let E=m$(k.body,new S).add(new S(0,k.body.rig.h*0.8,0));if(this.project(E,M),Math.hypot(M.x-$,M.y-J)<=H)return k.id}let K=null,W=Q?34:24;for(let k of this.model.persons){if(k.id===this.model.selected)continue;k.body.fk();let E=k.body;for(let w=1;w<X1;w++){if(x8(w))continue;this.project(E.wp[s1[w]],M);let{x:R,y:Z}=M;this.project(E.wp[w],M);let U=M.x-R,X=M.y-Z,G=U*U+X*X||1,q=Math.max(0,Math.min(1,(($-R)*U+(J-Z)*X)/G)),Y=Math.hypot(R+q*U-$,Z+q*X-J);if(Y<W)W=Y,K=k.id}}return K}rayAt($,J){let Q=C6.set($/this.cw*2-1,-(J/this.ch)*2+1,0.5).unproject(this.cam);return new h8(this.cam.position.clone(),Q.sub(this.cam.position).normalize())}bind(){let $=this.overlay;$.addEventListener("pointerdown",this.onDown),$.addEventListener("pointermove",this.onMove),$.addEventListener("pointerup",this.onUp),$.addEventListener("pointercancel",this.onUp),$.addEventListener("pointerleave",()=>{if(this.hover&&!this.drag)this.hover=null,this.dirty=!0}),$.addEventListener("wheel",this.onWheel,{passive:!1}),$.addEventListener("contextmenu",(J)=>J.preventDefault()),$.addEventListener("dblclick",()=>{if(!this.drag)this.frameFigures(),this.dirty=!0}),this.root.addEventListener("keydown",this.onKey)}local($){let J=this.overlay.getBoundingClientRect();return{x:$.clientX-J.left,y:$.clientY-J.top}}onDown=($)=>{this.root.focus({preventScroll:!0});let{x:J,y:Q}=this.local($);this.overlay.setPointerCapture($.pointerId),this.pointers.set($.pointerId,{x:J,y:Q});let M=$.pointerType==="touch";if(this.pointers.size===2){this.cancelDrag();let[K,W]=[...this.pointers.values()];this.gesture={kind:"pinch",x:J,y:Q,dist:Math.hypot(K.x-W.x,K.y-W.y),cx:(K.x+W.x)/2,cy:(K.y+W.y)/2};return}if(this.pointers.size>2)return;if($.button===0||M){let K=this.pick(J,Q,M);if(K&&!$.shiftKey){this.startDrag(K,J,Q,$);return}let W=this.pickPerson(J,Q,M);if(W!==null&&W!==this.model.selected){this.selectPerson(W);return}if(this.mode==="fk"&&this.selJoint!==null)this.selJoint=null,this.dirty=!0,this.emitState()}let H=$.button===1||$.button===2||$.button===0&&($.shiftKey||$.metaKey);this.gesture={kind:H?"pan":"orbit",x:J,y:Q},this.root.style.cursor=H?"move":"grabbing"};startDrag($,J,Q,M){let K=this.sel().body;this.model.begin();let W=this.rayAt(J,Q),k=this.cam.getWorldDirection(new S),E=C6.copy($.pos).sub(this.cam.position).dot(k),w=W.origin.clone().addScaledVector(W.direction,E/Math.max(0.000001,W.direction.dot(k))),R={handle:$,offset:$.pos.clone().sub(w),depth:0,d0:E,fwd:k,lx:J,ly:Q,moved:!1,startQ:$.kind==="foot"?K.wq[Z8[$.id].end].clone():null,headQ:$.kind==="head"?K.wq[r.head].clone():null,pinned:!1,alt:M.altKey||M.ctrlKey};if(this.drag=R,$.joint!==void 0)this.selJoint=$.joint,this.emitState();this.root.style.cursor="grabbing",this.dirty=!0}cancelDrag(){if(!this.drag)return;if(this.model.end())this.emitState();this.drag=null}onMove=($)=>{let{x:J,y:Q}=this.local($),M=this.pointers.get($.pointerId);if(M)M.x=J,M.y=Q;let H=$.pointerType==="touch";if(this.drag){let K=this.drag,W=Q-K.ly,k=J-K.lx;if($.altKey||$.ctrlKey||this.depthMode&&this.mode==="ik"&&K.handle.kind!=="floor")K.depth+=-W*0.004*Math.max(1,K.d0);if(this.mode==="fk")this.fkDrag(K,k,W,$.altKey||$.ctrlKey);else if(!($.altKey||$.ctrlKey||this.depthMode)||K.handle.kind==="floor")this.ikDrag(K,J,Q);else this.ikDrag(K,K.lx,K.ly);K.lx=J,K.ly=Q,K.moved=!0,this.changed();return}if(this.gesture){let K=this.gesture;if(K.kind==="pinch"&&this.pointers.size===2){let[W,k]=[...this.pointers.values()],E=Math.hypot(W.x-k.x,W.y-k.y),w=(W.x+k.x)/2,R=(W.y+k.y)/2;this.view.dist=Math.min(30,Math.max(0.5,this.view.dist*(K.dist/Math.max(1,E)))),this.panBy(w-K.cx,R-K.cy),K.dist=E,K.cx=w,K.cy=R}else if(K.kind==="orbit")this.view.az-=(J-K.x)*0.0075,this.view.el=Math.max(-1.52,Math.min(1.52,this.view.el+(Q-K.y)*0.0075)),K.x=J,K.y=Q;else if(K.kind==="pan")this.panBy(J-K.x,Q-K.y),K.x=J,K.y=Q;this.dirty=!0,this.changed();return}if(!H){let K=this.pick(J,Q,!1),W=K?.id??null;if(W!==this.hover)this.hover=W,this.dirty=!0;this.root.style.cursor=K?"grab":"default"}};onUp=($)=>{this.pointers.delete($.pointerId);try{this.overlay.releasePointerCapture($.pointerId)}catch{}if(this.drag){if(this.model.end())this.emitState(),this.changed();this.drag=null}if(this.pointers.size===0)this.gesture=null;else if(this.pointers.size===1&&this.gesture?.kind==="pinch"){let J=[...this.pointers.values()][0];this.gesture={kind:"orbit",x:J.x,y:J.y}}this.root.style.cursor="default",this.dirty=!0};panBy($,J){let H=2*this.view.dist*Math.tan(this.cam.fov*Math.PI/360)/this.ch,K=C6.set(1,0,0).applyQuaternion(this.cam.quaternion),W=n8.set(0,1,0).applyQuaternion(this.cam.quaternion);this.view.target.addScaledVector(K,-$*H).addScaledVector(W,J*H)}onWheel=($)=>{if($.preventDefault(),this.drag){this.drag.depth+=-$.deltaY*0.0015*Math.max(1,this.drag.d0),this.ikDrag(this.drag,this.drag.lx,this.drag.ly),this.changed();return}if($.shiftKey)this.panBy(-$.deltaX-$.deltaY*($.deltaX===0?1:0),0),this.panBy(0,0);let J=$.ctrlKey?0.012:0.0015;if(this.view.dist=Math.min(30,Math.max(0.5,this.view.dist*Math.exp($.deltaY*J))),!$.ctrlKey&&Math.abs($.deltaX)>Math.abs($.deltaY)*1.5)this.panBy(-$.deltaX,0),this.view.dist=Math.min(30,Math.max(0.5,this.view.dist/Math.exp($.deltaY*J)));this.dirty=!0,this.changed()};ikDrag($,J,Q){let H=this.sel().body,K=$.handle,W=this.rayAt(J,Q),k=new r1().setFromNormalAndCoplanarPoint($.fwd,this.cam.position.clone().addScaledVector($.fwd,$.d0+$.depth)),E=W.intersectPlane(k,new S);if(!E&&K.kind!=="floor")return;let w=E?E.add($.offset):K.pos.clone();if(H.fk(),K.kind==="floor"){let R=new r1(H7,0),Z=W.intersectPlane(R,new S);if(!Z||W.direction.y>-0.04)return;if(!$.floorStart)$.floorStart={hit:Z.clone(),root:H.rootP.clone(),pins:v1.map((X)=>H.pins[X]?.p.clone()??null)};let U=Z.clone().sub($.floorStart.hit);H.rootP.set($.floorStart.root.x+U.x,H.rootP.y,$.floorStart.root.z+U.z),v1.forEach((X,G)=>{let q=H.pins[X],Y=$.floorStart.pins[G];if(q&&Y)q.p.set(Y.x+U.x,Y.y,Y.z+U.z)}),H.fk(),d8(H);return}switch(K.kind){case"pelvis":H.rootP.copy(w),cM(H),d8(H);break;case"chest":oJ(H,dM,r.spine3,C6.set(0,0,0),w,{iters:16,weights:[0.9,0.9]}),d8(H);break;case"head":{if(oJ(H,gM,r.head,new S(0,H.rig.h*0.45,0),w,{iters:24,weights:lM}),$.headQ)QH.copy(H.wq[r.head]).slerp($.headQ,0.55),MH.copy(H.wq[r.neck]).invert().multiply(QH),H.q[r.head].copy(MH),H.fk(r.head);d8(H);break}case"hand":case"foot":{let R=K.id,Z=Z8[R],U=H.pins[R];if(I5(H,Z,w,{endQ:U?U.q:$.startQ}),U)U.p.copy(H.wp[Z.end]),U.q.copy(H.wq[Z.end]);break}case"elbow":case"knee":{let R=K.id.slice(-1),Z=w5[`${K.kind==="elbow"?"arm":"leg"}${R}`],U=H.pins[Z.pin];if(U)I5(H,Z,U.p,{elbow:w,endQ:U.q});else mM(H,Z.root,Z.mid,w);break}}H.fk()}fkDrag($,J,Q,M){let H=$.handle.joint;if(H===void 0)return;let K=this.sel().body;K.fk();let W=C6.set(0,1,0).applyQuaternion(this.cam.quaternion).clone(),k=n8.set(1,0,0).applyQuaternion(this.cam.quaternion).clone(),E=0.012,w;if(M){let R=new S().copy(K.rig.dir[H]).applyQuaternion(K.wq[H]).normalize();w=new m0().setFromAxisAngle(R,J*E)}else w=new m0().setFromAxisAngle(W,J*E).multiply(new m0().setFromAxisAngle(k,Q*E));uM(K,H,w),d8(K)}onKey=($)=>{this.handleKey($)};handleKey($){let J=$.target;if(J&&(J.tagName==="INPUT"||J.tagName==="SELECT"||J.tagName==="TEXTAREA")&&!($.ctrlKey||$.metaKey))return!1;let Q=$.ctrlKey||$.metaKey,M=$.key.toLowerCase(),H=!0;if(Q&&M==="z")if($.shiftKey)this.redo();else this.undo();else if(Q&&M==="y")this.redo();else if(Q&&M==="c")this.copyPose();else if(Q&&M==="v")this.pastePose();else if(!Q&&M==="m")this.mirror();else if(!Q&&M==="r")this.reset();else if(!Q&&M==="f")this.frameFigures(),this.changed();else if(!Q&&M==="g")this.setShowGrid(!this.showGrid);else if(!Q&&M==="x")this.setMode(this.mode==="ik"?"fk":"ik");else if(!Q&&/^[1-4]$/.test(M))this.selectIndex(Number(M)-1);else if(!Q&&(M==="delete"||M==="backspace"))this.removePerson();else H=!1;if(H)$.preventDefault();return H}exportCamera($,J){this.updateCamera();let Q=new F1(this.view.fov,$/J,0.05,120);return Q.position.copy(this.cam.position),Q.quaternion.copy(this.cam.quaternion),Q.updateMatrixWorld(),Q}getKeypoints2D($={}){let[J,Q]=[$.width??this.out[0],$.height??this.out[1]],M=this.exportCamera(J,Q);return this.model.persons.map((H)=>Q7(H.body,M,H.id))}exportImageData($,J={}){let Q=J.width??this.out[0],M=J.height??this.out[1],H=this.exportCamera(Q,M);if($==="skeleton"){let W=this.model.persons.map((E)=>Q7(E.body,H,E.id)),k=M7(W,Q,M,{hands:J.hands??!0,face:J.face??!0,scale:J.thumb?Q/this.out[0]:1});return new ImageData(k.data,Q,M)}if(!this.gpu)throw Error("WebGL2 is required for this map");this.gpu.sync(this.model.persons.map((W)=>({id:W.id,body:W.body,color:W.color})));let K=this.gpu.renderMap($,H,Q,M,{regionMode:J.regionMode});return this.dirty=!0,K}async exportMap($,J={}){return(await this.exportResult($,J)).blob}async exportResult($,J={}){let Q=this.exportImageData($,J);return{kind:$,width:Q.width,height:Q.height,imageData:Q,blob:await HH(Q)}}async exportAll($={}){let J={};for(let Q of s8)J[Q]=await this.exportResult(Q,$);return J}exportAllImageData($={}){let J={};for(let Q of s8)J[Q]=this.exportImageData(Q,$);return J}getPose(){let $=this.model.getPose();return $.cam={az:Math.round(this.view.az*180/Math.PI*100)/100,el:Math.round(this.view.el*180/Math.PI*100)/100,d:Math.round(this.view.dist*1000)/1000,t:[this.view.target.x,this.view.target.y,this.view.target.z].map((J)=>Math.round(J*1000)/1000),fov:this.view.fov},$.out=[...this.out],$}setPose($){let J=typeof $==="string"?B6($):$;if(this.model.push(),this.model.setPose(J),J.cam)this.view.az=J.cam.az*Math.PI/180,this.view.el=J.cam.el*Math.PI/180,this.view.dist=J.cam.d,this.view.target.set(J.cam.t[0],J.cam.t[1],J.cam.t[2]),this.view.fov=J.cam.fov;if(J.out)this.out=[J.out[0],J.out[1]];this.selJoint=null,this.changed(),this.emit("select",this.model.selected)}getPoseString(){return J7(this.getPose())}setPoseString($){this.setPose(B6($))}importKeypoints2D($){let{importKeypoints:J}=nw,Q=$.map((M)=>Array.isArray(M)?{x:M[0],y:M[1],v:M[2]??1}:M);this.model.push(),J(this.sel().body,Q,this.exportCamera(this.out[0],this.out[1]),this.out),this.changed()}destroy(){if(this.destroyed)return;this.destroyed=!0,cancelAnimationFrame(this.raf),this.ro?.disconnect(),this.root.removeEventListener("keydown",this.onKey),this.gpu?.dispose(),this.gpu=null,this.root.remove(),this.listeners.clear(),this.pointers.clear()}static sanitizeProps=O6;static maxPeople=c8;static presets=m8;static views=o$;static sizes=s$}function HH($){if(typeof OffscreenCanvas<"u"){let Q=new OffscreenCanvas($.width,$.height);return Q.getContext("2d").putImageData($,0,0),Q.convertToBlob({type:"image/png"})}let J=document.createElement("canvas");return J.width=$.width,J.height=$.height,J.getContext("2d").putImageData($,0,0),new Promise((Q,M)=>J.toBlob((H)=>H?Q(H):M(Error("PNG encode failed")),"image/png"))}var nw={importKeypoints:($,J,Q,M)=>{}};var sw={undo:"M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",redo:"m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",mirror:"M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z",reset:"M4 12a8 8 0 1 0 3-6.2M4 4v5h5",copy:"M9 9h11v11H9zM5 15V5h10",paste:"M8 4h8v3H8zM6 5H5v16h14V5h-1M9 13h6M9 17h4",userPlus:"M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6",userMinus:"M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 11h6",view:"M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",grid:"M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",shadow:"M3 17c0-2 4-3.5 9-3.5s9 1.5 9 3.5-4 3.5-9 3.5-9-1.5-9-3.5zM12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",bones:"M4 4h4v4H4zM16 16h4v4h-4zM8 8l8 8",frame:"M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",depth:"M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4",pin:"M12 17v5M8 3h8l-1 6 3 4H6l3-4z",download:"M12 4v11M7 11l5 5 5-5M5 20h14",export:"M12 15V3M7 8l5-5 5 5M5 21h14",chevron:"m6 9 6 6 6-6"},W7={mesh:"Mesh",skeleton:"Skeleton",depth:"Depth",region:"Region"},ow=[["footL","LF","Pin left foot"],["footR","RF","Pin right foot"],["handL","LH","Pin left hand"],["handR","RH","Pin right hand"]],iw=[{key:"headsTall",label:"Heads tall",step:0.1,fmt:($)=>$.toFixed(1),hint:"7.5 realistic, 9 stylized"},{key:"height",label:"Height",step:0.01,fmt:($)=>`${$.toFixed(2)} m`},{key:"shoulder",label:"Shoulder width",step:0.01,fmt:($)=>`${$.toFixed(2)}x`},{key:"hip",label:"Hip width",step:0.01,fmt:($)=>`${$.toFixed(2)}x`},{key:"limb",label:"Limb length",step:0.01,fmt:($)=>`${$.toFixed(2)}x`}],_6=0;function KH($,J={}){let Q=[],M=!1,H=(A,n,_,o)=>{A.addEventListener(n,_,o),Q.push(()=>A.removeEventListener(n,_,o))};if(J.ui===!1){let A=new d5($,J);if(J.onChange)Q.push(A.on("change",()=>J.onChange(JSON.stringify(A.getPose()))));return{studio:A,el:$,getPose:()=>A.getPose(),setPose:(n)=>A.setPose(n),exportAll:(n)=>A.exportAll(n),exportMap:(n,_)=>A.exportMap(n,_),destroy(){if(M)return;M=!0,Q.forEach((n)=>n()),A.destroy()}}}let K=(A,n={},..._)=>{let o=document.createElement(A);for(let[$0,k0]of Object.entries(n)){if(k0===void 0||k0===!1||k0===null)continue;if($0==="class")o.className=k0;else if($0==="on")for(let[Q0,i]of Object.entries(k0))H(o,Q0,i);else o.setAttribute($0,k0===!0?"":String(k0))}for(let $0 of _)if($0)o.append($0);return o},W=(A)=>{let n=document.createElementNS("http://www.w3.org/2000/svg","svg");n.setAttribute("viewBox","0 0 24 24"),n.setAttribute("aria-hidden","true"),n.setAttribute("class","ps-ico");let _=document.createElementNS("http://www.w3.org/2000/svg","path");return _.setAttribute("d",sw[A]),n.append(_),n},k=(A,n,_={})=>K("button",{type:"button",class:`ps-btn ${_.cls??""}`,"aria-label":A,title:A,"aria-pressed":_.toggle?"false":void 0,on:{click:n}},_.icon&&W(_.icon),_.text&&K("span",{class:"ps-btn-t"},_.text)),E=(A,n)=>A.setAttribute("aria-pressed",String(n)),w=(A,n,..._)=>K("details",{class:"ps-sec",open:!0,"data-sec":A},K("summary",{class:"ps-sec-h"},K("span",{},n),W("chevron")),K("div",{class:"ps-sec-b"},..._)),R=(A,...n)=>K("div",{class:"ps-grp",role:"group","aria-label":A},...n),Z=K("div",{class:"ps-canvas"}),U=new d5(Z,J),X=U.getState(),G="person",q=!0,Y=!0,N=["ik","fk"].map((A)=>k(A==="ik"?"Inverse kinematics: drag hands and feet":"Forward kinematics: rotate joints",()=>U.setMode(A),{text:A.toUpperCase(),toggle:!0})),B=k("Depth drag: moving a handle changes its distance from the camera",()=>U.setDepthMode(!X.depthMode),{icon:"depth",text:"Depth",toggle:!0}),D=k("Undo (Ctrl+Z)",()=>U.undo(),{icon:"undo"}),V=k("Redo (Ctrl+Shift+Z)",()=>U.redo(),{icon:"redo"}),h=ow.map(([A,n,_])=>Object.assign(k(_,()=>U.togglePin(A),{icon:"pin",text:n,toggle:!0}),{_k:A})),C=k("Paste pose (Ctrl+V)",()=>U.pastePose(),{icon:"paste"}),z=k("Add person",()=>U.addPerson(),{icon:"userPlus"}),y=k("Remove selected person (Delete)",()=>U.removePerson(),{icon:"userMinus"}),P=k("Toggle floor grid (G)",()=>U.setShowGrid(!X.grid),{icon:"grid",toggle:!0}),F=k("Toggle shadow",()=>U.setShowShadow(!X.shadow),{icon:"shadow",toggle:!0}),f=k("Toggle bone overlay",()=>U.setShowBones(!X.bones),{icon:"bones",toggle:!0}),u=`ps-menu-${++_6}`,x=K("div",{class:"ps-menu",id:u,role:"menu",hidden:!0},...o$.map((A)=>K("button",{type:"button",class:"ps-menu-i",role:"menuitem",on:{click:()=>{U.setCameraView(A),d(),c.focus()}}},A))),c=k("Camera view presets",()=>x.hidden?t():d(),{icon:"view",text:"View"});c.setAttribute("aria-haspopup","menu"),c.setAttribute("aria-controls",u),c.setAttribute("aria-expanded","false");let t=()=>{x.hidden=!1,c.setAttribute("aria-expanded","true")},d=()=>{x.hidden=!0,c.setAttribute("aria-expanded","false")};H(document,"pointerdown",(A)=>{if(!x.hidden&&!x.contains(A.target)&&!c.contains(A.target))d()}),H(x,"keydown",(A)=>{if(A.key==="Escape")d(),c.focus(),A.stopPropagation()});let e=K("div",{class:"ps-toolbar",role:"toolbar","aria-label":"Pose tools"},R("Mode",K("div",{class:"ps-seg"},...N),B),R("History",D,V,k("Mirror pose (M)",()=>U.mirror(),{icon:"mirror"}),k("Reset pose (R)",()=>U.reset(),{icon:"reset"})),R("Pins",...h),R("Pose clipboard",k("Copy pose (Ctrl+C)",()=>U.copyPose(),{icon:"copy"}),C),R("People",z,y),R("Camera",K("div",{class:"ps-menu-wrap"},c,x),k("Frame figures (F)",()=>{U.frameFigures()},{icon:"frame"})),R("Display",P,F,f)),g=K("div",{class:"ps-stage"},Z,e),W0=K("div",{class:"ps-chips",role:"group","aria-label":"People"}),w0="";H(W0,"click",(A)=>{let n=A.target.closest("[data-id]");if(n)U.selectPerson(Number(n.dataset.id))});let z0=K("div",{class:"ps-presets"},...m8.map((A)=>K("button",{type:"button",class:"ps-chip ps-preset",title:A,"aria-label":`Preset: ${A}`,"data-n":A},A)));H(z0,"click",(A)=>{let n=A.target.closest("[data-n]");if(n)U.setPreset(n.dataset.n)});let b0="both",c0=["L","R","both"].map((A)=>{return k(A==="both"?"Apply hand shape to both hands":`Apply hand shape to ${A==="L"?"left":"right"} hand`,()=>{b0=A,c0.forEach((_,o)=>E(_,o===["L","R","both"].indexOf(A)))},{text:A==="both"?"Both":A,toggle:!0})});c0.forEach((A,n)=>E(A,n===2));let p=K("div",{class:"ps-presets ps-hands"},...iJ.map((A)=>K("button",{type:"button",class:"ps-chip","aria-label":`Hand shape: ${A}`,title:A,on:{click:()=>U.setHandShape(b0,A)}},A))),M0=new Map,U0=(A,n,_,o,$0,k0,Q0,i,P0,v0)=>{let s0=K("input",{type:"range",class:"ps-range",id:A,min:_,max:o,step:$0}),o0=K("output",{class:"ps-val",for:A}),q1={input:s0,out:o0,dragging:!1};M0.set(A,q1);let V1=()=>{if(!q1.dragging)return;q1.dragging=!1,window.removeEventListener("pointerup",V1),window.removeEventListener("pointercancel",V1),v0?.()};return Q.push(()=>{window.removeEventListener("pointerup",V1),window.removeEventListener("pointercancel",V1)}),H(s0,"pointerdown",()=>{if(q1.dragging)return;q1.dragging=!0,P0?.(),window.addEventListener("pointerup",V1),window.addEventListener("pointercancel",V1)}),H(s0,"input",()=>{let D5=Number(s0.value);o0.textContent=k0(D5),i(D5,q1.dragging)}),{el:K("div",{class:"ps-row"},K("div",{class:"ps-row-h"},K("label",{for:A},n),o0),s0,Q0&&K("div",{class:"ps-hint"},Q0)),set:(D5)=>{if(!q1.dragging)s0.value=String(D5);o0.textContent=k0(D5)}}},Z0=iw.map((A)=>({r:A,s:U0(`ps-p-${_6}-${A.key}`,A.label,E8[A.key][0],E8[A.key][1],A.step,A.fmt,A.hint,(n,_)=>_?U.previewProportions({[A.key]:n}):U.setProportions({[A.key]:n}),()=>U.beginEdit(),()=>U.endEdit())})),X0=U0(`ps-fov-${_6}`,"Field of view",12,90,1,(A)=>`${Math.round(A)} deg`,void 0,(A)=>U.setFov(A)),y0=(A,n)=>`${A}x${n}`,T0=K("select",{class:"ps-select",id:`ps-size-${_6}`,"aria-label":"Output size"},...s$.map(([A,n])=>K("option",{value:y0(A,n)},`${A}x${n}`)));H(T0,"change",()=>{let[A,n]=T0.value.split("x").map(Number);U.setOutputSize(A,n)});let _0=K("select",{class:"ps-select",id:`ps-region-${_6}`,"aria-label":"Region map mode"},K("option",{value:"person"},"Per person"),K("option",{value:"parts"},"Body parts"));H(_0,"change",()=>{G=_0.value,R0()});let T=(A,n,_)=>{let o=K("input",{type:"checkbox",class:"ps-check"});return o.checked=n,H(o,"change",()=>{_(o.checked),R0()}),K("label",{class:"ps-checklab"},o,K("span",{},A))},l0=(A,n,_)=>K("div",{class:"ps-field"},K("label",{for:n},A),_),B0=new Map,p0=K("div",{class:"ps-thumbs"},...s8.map((A)=>{let n=K("canvas",{class:"ps-thumb-cv",role:"img","aria-label":`${W7[A]} map preview`});return B0.set(A,{cv:n,ctx:n.getContext("2d")}),K("figure",{class:"ps-thumb"},n,K("figcaption",{class:"ps-thumb-c"},K("span",{},W7[A]),k(`Download ${W7[A]} map as PNG`,()=>{b(A)},{icon:"download",cls:"ps-btn-sm"})))})),D0=K("span",{class:"ps-status",role:"status","aria-live":"polite"}),d0=0,N0=(A,n=!1)=>{if(D0.textContent=A,D0.classList.toggle("ps-err",n),clearTimeout(d0),A)d0=window.setTimeout(()=>{D0.textContent=""},3500)},q0=K("textarea",{class:"ps-text",rows:5,"aria-label":"Pose JSON",placeholder:"Paste pose JSON or encoded pose string",spellcheck:"false"}),J1=K("div",{class:"ps-error",role:"alert"}),t0=K("div",{class:"ps-paste",hidden:!0},q0,J1,K("div",{class:"ps-paste-a"},k("Apply pose JSON",()=>{let A=q0.value.trim();try{if(!A)throw Error("Nothing to apply");U.setPose(A.startsWith("{")?JSON.parse(A):A),J1.textContent="",t0.hidden=!0,N0("Pose applied")}catch(n){J1.textContent="Invalid pose data: expected pose JSON or an encoded pose string"}},{text:"Apply",cls:"ps-btn-primary"}),k("Cancel",()=>{t0.hidden=!0,J1.textContent=""},{text:"Cancel"}))),W1=async()=>{let A=JSON.stringify(U.getPose());try{await navigator.clipboard.writeText(A),N0("Pose JSON copied")}catch{q0.value=A,t0.hidden=!1,q0.focus(),q0.select(),N0("Select and copy the JSON below")}},I=(A={})=>({regionMode:G,hands:q,face:Y,...A}),O=(A,n)=>{let _=URL.createObjectURL(A),o=K("a",{href:_,download:n});document.body.append(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(_),4000)},b=async(A)=>{try{let n=await U.exportMap(A,I()),[_,o]=U.getOutputSize();O(n,`pose-${A}-${_}x${o}.png`)}catch(n){N0(n instanceof Error?n.message:"Export failed",!0)}},a=k("Export all maps",async()=>{a.disabled=!0;try{let A=await U.exportAll(I());if(J.onExport)J.onExport(A);else for(let n of s8)O(A[n].blob,`pose-${n}-${A[n].width}x${A[n].height}.png`);N0("Exported")}catch(A){N0(A instanceof Error?A.message:"Export failed",!0)}a.disabled=!1},{icon:"export",text:"Export maps",cls:"ps-btn-primary ps-btn-wide"}),J0=K("div",{class:"ps-panel-body"},w("people","People",W0),w("presets","Presets",z0),w("maps","Maps",p0),w("hands","Hands",R("Hand side",...c0),p),w("props","Proportions",...Z0.map((A)=>A.s.el)),w("camera","Camera and output",X0.el,l0("Output size",T0.id,T0),l0("Region map",_0.id,_0),K("div",{class:"ps-checks"},K("span",{class:"ps-lab"},"Skeleton"),T("Hands",q,(A)=>q=A),T("Face",Y,(A)=>Y=A)))),s=K("div",{class:"ps-panel-foot"},t0,K("div",{class:"ps-foot-r"},a,k("Copy pose JSON",()=>{W1()},{icon:"copy",text:"Copy JSON"}),k("Paste pose JSON",()=>{if(t0.hidden=!t0.hidden,!t0.hidden)q0.focus()},{icon:"paste",text:"Paste JSON"})),D0),O0=K("aside",{class:"ps-panel","aria-label":"Pose settings"},J0,s),E0=K("div",{class:"ps-app"},g,O0),L0=K("div",{class:"ps-root"},E0);$.append(L0),H(L0,"keydown",(A)=>{if(A.defaultPrevented)return;let n=A.target;if(n.tagName==="TEXTAREA"||n.tagName==="INPUT"&&!["range","checkbox"].includes(n.type))return;if((A.key==="Delete"||A.key==="Backspace")&&n.tagName==="BUTTON")return;U.handleKey(A)});let S0=0,H0="",R0=()=>{if(S0||M)return;S0=window.setTimeout(()=>{S0=0,C0()},250)},C0=()=>{if(M)return;let[A,n]=X.size,_=200/Math.max(A,n),o=Math.max(16,Math.round(A*_)),$0=Math.max(16,Math.round(n*_)),k0=`${o}x${$0}`;for(let[Q0,i]of B0){if(k0!==H0)i.cv.width=o,i.cv.height=$0,i.cv.style.aspectRatio=`${o} / ${$0}`;try{i.ctx.putImageData(U.exportImageData(Q0,{width:o,height:$0,thumb:!0,regionMode:G,hands:q,face:Y}),0,0)}catch{i.ctx.clearRect(0,0,o,$0)}}H0=k0},I0=(A)=>{X=A,N.forEach((o,$0)=>E(o,A.mode===($0===0?"ik":"fk"))),E(B,A.depthMode),E(P,A.grid),E(F,A.shadow),E(f,A.bones),D.disabled=!A.canUndo,V.disabled=!A.canRedo,C.disabled=!A.canPaste,z.disabled=A.people.length>=d5.maxPeople,y.disabled=A.people.length<=1;for(let o of h)E(o,A.pins[o._k]);let n=A.people.map((o)=>`${o.id}:${o.color}`).join(",")+`|${A.selected}`;if(n!==w0)w0=n,W0.replaceChildren(...A.people.map((o,$0)=>{let k0=w8[o.color%w8.length];return K("button",{type:"button",class:"ps-chip ps-person","data-id":o.id,"aria-label":`Select figure ${$0+1}`,title:`Figure ${$0+1} (key ${$0+1})`,"aria-pressed":String(o.id===A.selected)},K("i",{class:"ps-sw",style:`background:rgb(${k0[0]},${k0[1]},${k0[2]})`}),String($0+1))}));for(let{r:o,s:$0}of Z0){let k0=A.props?.[o.key];if(typeof k0==="number")$0.set(k0)}X0.set(A.fov);let _=y0(A.size[0],A.size[1]);if(![...T0.options].some((o)=>o.value===_))T0.append(K("option",{value:_},`${A.size[0]}x${A.size[1]}`));T0.value=_,R0()};return Q.push(U.on("state",(A)=>I0(A))),Q.push(U.on("change",()=>{if(R0(),J.onChange)J.onChange(JSON.stringify(U.getPose()))})),Q.push(U.on("select",()=>R0())),I0(X),{studio:U,el:L0,getPose:()=>U.getPose(),setPose:(A)=>U.setPose(A),exportAll:(A)=>U.exportAll(I(A)),exportMap:(A,n)=>U.exportMap(A,I(n)),destroy(){if(M)return;M=!0,clearTimeout(S0),clearTimeout(d0),Q.forEach((A)=>A()),Q.length=0,U.destroy(),L0.remove()}}}var aw={mount($,J={}){return KH($,J)},PoseStudio:d5,version:"1.0.0"};window.PoseStudioApp=aw;})();
