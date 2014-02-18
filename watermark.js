
(function() {

    var ImageProto = Image.prototype,
        CanvasProto = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype,
        root = this;

    if (!CanvasProto)
        return;

    var wm = function(obj) {
        if (obj instanceof wm)
            return obj;
        if (!(this instanceof wm))
            return new wm(obj);
        this.wrapped = obj; 
    };

    // AMD registration
    if (typeof define === 'function' && define.amd) {
        define('watermark', [], function() {
            return wm;
        });
    }

    // Global defaults
    var defaults = wm.defaults = {
        className:  "watermark",
        type:       "image/jpeg",
        position:   "top-right",
        padding:    25,
        opacity:    0.8, // 100%
        watermark:  {
            standard:   "img/watermark.png?"+(+(new Date())),
            highres:    "img/watermark-high-res.png?"+(+(new Date()))
        },
        sizes:      { // width, height, crop, watermark
            large:      [1280, 768, true,  "highres",   1],
            standard:   [ 700, 420, true, "standard", 0.8],
            low:        [ 320, 200, true,     "none", 0.8],
            thumbnail:  [ 128,  80, true,     "none", 0.8] 
        }
    };

    var each = function(obj, iterator, context) {
        if (obj == null) return obj;
        if (Array.prototype.forEach && obj.forEach === Array.prototype.forEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, length = obj.length; i < length; i++) {
                if (iterator.call(context, obj[i], i, obj) === {}) return;
            }
        } else {
            var keys = keys(obj);
            for (var i = 0, length = keys.length; i < length; i++) {
                if (iterator.call(context, obj[keys[i]], keys[i], obj) === {}) return;
            }
        }
        return obj;
    };

    var keys = function(obj) {
        if (obj !== Object(obj)) return [];
        if (Object.keys) return Object.keys(obj);
        var keys = [];
        for (var key in obj) if (obj.hasOwnProperty(key)) keys.push(key);
        return keys;
    };

    var extend = function(obj){
        each(slice.call(arguments, 1), function(source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
    };

    /** 
     * Load watermark images
     * Replaces URL String with Image Object
     *
     * @param   {Object}    (Optional) Object of new or replacement watermark images
     * @param   {function}  (Optional) Callback function 
     * @return  {void}
     */
    var loadWatermarks = wm.loadWatermarks = function(obj, callback) {

        if (typeof obj !== "undefined") {
            extend(defaults.watermark, obj);
        }

        var len = keys(defaults.watermark).length,
            complete = 0;

        for(var key in defaults.watermark){

            var image = defaults.watermark[key],
                path;

            if (typeof image === "string")
                path = image;
            else
                continue;

            image = new Image();

            image.onload = (function(aKey, aImage){  
                return function(){
                    if(defaults.opacity !== 1)
                        defaults.watermark[aKey] = applyTransparency(aImage);

                    complete++;

                    if( typeof callback === "function" && complete === len )
                        callback();
                };
            })(key, image);

            image.src = path;
        }
    };

    /**
     * Apply Transparency to first parameter or parent Image
     * 
     * @param   {Image}     (Optional) Image for transparency to be applied to, fallback to parent
     * @param   {Number}    (Optional) Value of transparency to override default (0 - 1)
     * @return  {Image}     Processed Image
     */
    var applyTransparency = wm.applyTransparency = function(image, opacity) {

        if (typeof image === "undefined") {
            image = this; 
        }

        if (typeof opacity !== "undefined") {
            defaults.opacity = opacity;
        }

        var canvas = new Canvas(),
            width = image.width,
            height = image.width;;

        canvas.node.width = image.width;
        canvas.node.height = image.height;

        canvas.ctx.drawImage(image, 0, 0);

        image = canvas.ctx.getImageData(0, 0, width, height);

        var data = image.data,
            len = data.length,
            i = 3;

        for (; i < len; i += 4) {  
            data[i] *= defaults.opacity;
        }

        image.data = data;
        canvas.ctx.putImageData(image, 0, 0);
        
        image = new Image();
        
        image.src = canvas.node.toDataURL();
        image.width = width;
        image.height = height;

        return image;
    };

    /**
     * Canvas class
     * Contains all logic for resizing and applying watermarks
     * Most inner functions return {Canvas}, this is the class, not the node.
     *
     * @param   {string}    (Optional) Reference to sizes object (defaults.sizes)
     */
    var Canvas = root.Canvas = function(size) {

        var self = this;

        self.node = document.createElement("canvas");
        self.ctx = self.node.getContext("2d");
        self.type = size || "standard";

        /**
         * Simple resizing
         * Crappy default scaling (bilinear)
         *
         * @param   {Image}     (Optional) Image to use instead of parent
         * @return  {Canvas}
         */
        self.resize = function(image){

            image = image || defaults.master;

            var width = image.width,
                height = image.height,
                maxWidth = defaults.sizes[self.type][0];
            
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }

            self.node.width = width;
            self.node.height = height;
            self.ctx.drawImage(image, 0, 0, width, height);

            return self;
        };

        /**
         * Apply watermark to canvas
         *
         * @return  {Canvas}
         */
        self.watermark = function() {

            if(defaults.sizes[self.type][3] === "none")
                return self;

            var x = y = defaults.padding,
                image = defaults.watermark[defaults.sizes[self.type][3]];


            if(defaults.position.indexOf("top") === -1)
                y = self.node.height - image.height - y;

            if(defaults.position.indexOf("left") === -1)
                x = self.node.width - image.width - x;

            self.ctx.drawImage(image, x, y);

            return self;
        };

        /**
         * Resize and Crop function
         * Utilizes bicubic interpolation
         *
         * @param   {Image}     (Optional) Image to override parent image
         * @param   {Number}    (Optional) Ideal width of image
         * @param   {Number}    (Optional) Ideal height of image
         * @param   {Boolean}   (Optional) Crop to enforce dstW && dstH 
         * @return  {Canvas}
         */
        self.resample = function(image, dstW, dstH, crop){

            image = image || defaults.master;
            dstW = dstW || defaults.sizes[self.type][0];
            dstH = dstH || defaults.sizes[self.type][1];
            crop = crop || defaults.sizes[self.type][2];

            var benchmark = (new Date()).getTime();

            var srcW = image.width,
                srcH = image.height,
                dstX = 0, dstY = 0, 
                srcX = 0, srcY = 0;

            self.node.width = srcW;
            self.node.height = srcH;

            self.ctx.drawImage(image, srcX, srcY, srcW, srcH);

            var ratio;
            if (crop) {
                ratio = Math.max(dstW / srcW, dstH / srcH); 
                srcX = parseInt((srcW - parseInt(dstW / ratio, 10)) / 2, 10);
                srcY = parseInt((srcH - parseInt(dstH / ratio, 10)) / 2, 10);
                srcH = Math.round(dstH / ratio);
                srcW = Math.round(dstW / ratio);
            } else {
                ratio = Math.min(dstW / srcW, dstH / srcH); 
                dstH = Math.round(srcH * ratio);
                dstW = Math.round(srcW * ratio);
            }

            var dst = new Uint8ClampedArray(dstW * dstH * 3), //[],
                src = self.ctx.getImageData(srcX, srcY, srcW, srcH).data,
                dstL = 0;

            var x, y;
            var sy1, sy2, sx1, sx2;

            for (y = dstY; y < dstY + dstH; y++) {
                sy1 = (y - dstY) * srcH / dstH; // Current Y Position * Scaling Ratio 
                sy2 = (y + 1 - dstY) * srcH / dstH; // Next Y Position * Scaling Ratio
                for (x = dstX; x < dstX + dstW; x++) {
                    var sx, sy;
                    var spixels = 0;
                    var red = 0, green = 0, blue = 0, alpha = 0;
                    var alpha_factor, alpha_sum = 0, contrib_sum = 0;
                    sx1 = (x - dstX) * srcW / dstW; // Current X Position * Scaling Ratio
                    sx2 = (x + 1 - dstX) * srcW / dstW; // Next X Position * Scaling Ratio
                    sy = sy1;
                    do {
                        var yportion;
                        if (Math.floor(sy) === Math.floor(sy1)) {
                            yportion = 1 - (sy - Math.floor(sy));
                            if (yportion > sy2 - sy1) {
                                yportion = sy2 - sy1;
                            }
                            sy = Math.floor(sy);
                        } else if (sy === Math.floor(sy2)) {
                            yportion = sy2 - Math.floor(sy2);
                        } else {
                            yportion = 1;
                        }
                        sx = sx1;
                        do {
                            var xportion;
                            var pcontribution;
                            var palpha;

                            if (Math.floor(sx) === Math.floor(sx1)) {
                                xportion = 1 - (sx - Math.floor(sx));
                                if (xportion > sx2 - sx1) {
                                    xportion = sx2 - sx1;
                                }
                                sx = Math.floor(sx);
                            } else if (sx === Math.floor(sx2)) {
                                xportion = sx2 - Math.floor(sx2);
                            } else {
                                xportion = 1;
                            }

                            pcontribution = xportion * yportion;

                            palpha = 127 - src[(sy * srcW + sx) * 4 + 3] / 255 * 127;

                            alpha_factor = ( 127 - palpha ) * pcontribution;
                            
                            red += src[(sy * srcW + sx) * 4] * alpha_factor;
                            green += src[(sy * srcW + sx) * 4 + 1] * alpha_factor;
                            blue += src[(sy * srcW + sx) * 4 + 2] * alpha_factor;
                            alpha += palpha * pcontribution;

                            alpha_sum += alpha_factor;
                            contrib_sum += pcontribution;
                            spixels += xportion * yportion;

                            sx += 1; 
                        }
                        while (sx < sx2);

                        sy += 1;
                    }
                    while (sy < sy2);

                    if (spixels !== 0) {
                        red /= spixels;
                        green /= spixels;
                        blue /= spixels;
                        alpha /= spixels;
                        //alpha += 0.5;
                    }
                    if (alpha_sum !== 0) {
                        if (contrib_sum !== 0) {
                            alpha_sum /= contrib_sum;
                        }
                        red /= alpha_sum;
                        green /= alpha_sum;
                        blue /= alpha_sum;
                    }
                    
                    dst[dstL++] = red;
                    dst[dstL++] = green;
                    dst[dstL++] = blue;

                }
            }

            self.node.width = dstW;
            self.node.height = dstH;

            src = self.ctx.getImageData(0, 0, dstW, dstH);

            var data = src.data; 
            dstL = data.length;

            for (x = 0, y = 0; x < dstL; x += 4, y += 3) {
                data[x] = dst[y];
                data[x + 1] = dst[y + 1];
                data[x + 2] = dst[y + 2];
                data[x + 3] = 255;//dst[y + 3];
            }
            
            self.ctx.putImageData(src, 0, 0);

            console.log(((new Date()).getTime() - benchmark) / 1000 + " seconds taken");

            return self;
            
        };

        /**
         * Convert Canvas to Blob
         * Useful for AWS upload
         *
         * @param   {String}    (Optional) Override default type
         * @return  {Blob}
         */
        self.toBlob = function(type) {

            if (typeof type === "undefined")
                type = defaults.type;

            var quality = defaults.sizes[self.type][4],
                i = 0,
                byteData;

            if (CanvasProto.mozGetAsFile && quality && CanvasProto.toDataURL) {
                return self.node.mozGetAsFile('blob', type);
            } else if (CanvasProto.toDataURL) {
                var dataURI = self.node.toDataURL(type, quality); 
            }

            if (dataURI.split(',')[0].indexOf('base64') >= 0)
                byteData = atob(dataURI.split(',')[1]);
            else
                byteData = decodeURIComponent(dataURI.split(',')[1]);

            var len = byteData.length,
                arrayBuffer = new ArrayBuffer(len),
                intArray = new Uint8Array(arrayBuffer);

            for (; i < len; i++) {
                intArray[i] = byteData.charCodeAt(i);
            }
            return new Blob([intArray], {type: type});
        };

        /**
         * Convert Canvas to Image
         *
         * @return {Image}
         */
        self.toImage = function() {
            var image = new Image(); 
            image.src = self.node.toDataURL('image/jpeg', defaults.sizes[self.type][4]);
            return image;
        };

        /**
         * Append current Canvas to dom
         *
         * @param   {HTML Element} (Optional) Element to append to
         * @return  {Canvas}
         */
        self.display = function(el) {
            
            var image = new Image(); 
            image.src = self.node.toDataURL('image/jpeg', defaults.sizes[self.type][4]);

            if (typeof el === "undefined")
                document.body.appendChild(image);
            else
                el.appendChild(image);

            return self;
        };

        return self;

    };
    
    /**
     * Process current image
     * should be chained after image load
     *
     * @param   {String}    (Optional) Format to return
     * @return  {Array}     Array of specified format, default to Blob
     */
    var process = wm.process = function(format) {

        var ret = [];

        if (typeof format === "undefined")
            format = "Blob";

        defaults.master = this;

        for(var type in defaults.sizes){
            ret.push(new Canvas(type).resample().watermark()["to" + format]());
        }

        return ret;
        
    };

    each(keys(wm), function(name) {
        ImageProto[name] = wm[name]; 
    });

    loadWatermarks();

}).call(this);
