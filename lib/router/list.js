// list.js -> handle list calls
//
// (c)2016 metasync r&d / internet of coins project - Joachim de Koning
//

// export every function
exports.process = process;

// functions start here

function process (request, xpath) {
  
    var result = {
            "error": 0,
            "info": "Listable items.",
            "id": "list",
            "data": ["asset"]
        };              


    // DEBUG: console.log(" [i] returning asset on request "+JSON.stringify(xpath));
    if (xpath.length > 1) {

        switch(xpath[1]) {
          case "asset":
            switch(xpath[2]) {
              case "names":
                result = assetnames();
                break;
              case "modes":
                result = assetmodes();
                break;
              default:
                result = {
                    "error": 0,
                    "info": "Please specify the property you want to list.",
                    "id": "list/asset",
                    "data": ["names","modes"]
                };
            }
            break;
          default:
            result = {
                "error": 1,
                "info": "Please specify what you want to list.",
                "id": "list",
                "data": ["asset"]
            };              
        }
    }

    return result;

}

// asset specific functions start here
function assetnames () {

    var assetcnt = 0;
    var asset = {};
    var key;
    for (key in global.hybridd.asset) {

        asset[key] = typeof global.hybridd.asset[key].name !== "undefined" ? global.hybridd.asset[key].name : global.hybridd.asset[key].module;
        assetcnt++;

    }

    return {
        "error": 0,
        "info": "List of asset names.",
        "id": "asset",
        "count": assetcnt,
        "data": functions.sortObjectByKey(asset)
    };

}

function assetmodes () {

    var assetcnt = 0;
    var asset = {};
    var key;
    for (key in global.hybridd.asset) {

        asset[key] = typeof global.hybridd.asset[key].mode !== "undefined" ? global.hybridd.asset[key].mode : global.hybridd.asset[key].module;
        assetcnt++;

    }

    return {
        "error": 0,
        "info": "List of asset modes.",
        "id": "asset",
        "count": assetcnt,
        "data": functions.sortObjectByKey(asset)
    };
}