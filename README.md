Watermark.js
===========================


Adds functionality to the JS Image Object allowing it to compress, resize, crop and watermark images.

Useful for uploading images straight to S3 without the need to resize prior.

####Basic usage:

```javascript
var image = new Image();

image.onload = function() {
    console.log(this.process());
}

image.src = "path/to/image/on/same/domain.png";
```

Output Array, all ready to be sent to S3:
```javascript
0: Blob
    size: 864521
    type: "image/jpeg"
1: Blob
    size: 68766
    type: "image/jpeg"
2: Blob
    size: 14915
    type: "image/jpeg"
3: Blob
    size: 2923
    type: "image/jpeg"
length: 4
```

####With uploaded images
```html
<input type="file" id="input" multiple />
```
```javascript
document.getElementById("input").addEventListener("change", function()
{
    for (var i = 0; i < this.files.length; i++) {
        var file = this.files[i],
            imageType = /image.*/;
        // Check file is an image
        if (!file.type.match(imageType))
            continue;
        
        var image = new Image();
        image.file = file;
        
        var reader = new FileReader();
        reader.onload = (function(img){
            // Closure to ensure safe passing of correct Image
            return function(e){
                img.src = e.target.result;
                console.log(img.process());
            };
        })(image);
        reader.readAsDataURL(file);
    }
}, false);
```

####Options
All options can be modified by changing the defaults at Image().defaults prior to processing.
**Note: If you wish to change or add a watermark, you should replace the string value with an Image Object**
```javascript
// Global defaults
var defaults = wm.defaults = {
    className:  "watermark",
    type:       "image/jpeg",
    position:   "top-right",
    padding:    25,
    opacity:    0.8,
    watermark:  {
        standard:   "img/watermark.png?"+(+(new Date())),
        highres:    "img/watermark-high-res.png?"+(+(new Date()))
    },
    sizes:      {   // width, height, crop, watermark, quality (if defaults.type supports it)
        large:      [1280, 768, true,  "highres",   1],
        standard:   [ 700, 420, true, "standard", 0.8],
        low:        [ 320, 200, true,     "none", 0.8],
        thumbnail:  [ 128,  80, true,     "none", 0.8] 
    }
};
```
