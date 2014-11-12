var exec = require('child_process').exec
  , fs = require('fs')
  ;

var variables = ['tg', 'tn', 'tx', 'rr', 'pp']
  , variable = ''
  , latitude_mn = 25.375
  , longitude_mn = -40.375
  , latitude_mx = 75.375
  , longitude_mx = 75.375
  , grid = 0.25
  , cmd = '' // ncks -C -d latitude,47.375 -d longitude,15.125 -v tg tg_0.25deg_reg_1995-2013_v10.0.nc'
  , fileName = '' // tg_47.375_15.125.json'
  , cmds = []
  , fileNames = []
  ;

for (var v = 0; v < variables.length; v++) {
  variable = variables[v];
  for (var lat = latitude_mn; lat <= latitude_mx; lat+=grid) {
    for (var lon = longitude_mn; lon <= longitude_mx; lon+=grid) {
      // console.log(lat + '/' + lon);
      cmds.push('ncks -C -d latitude,'+lat+' -d longitude,'+lon+' -v '+variable+' '+variable+'_0.25deg_reg_1995-2013_v10.0.nc');
      fileNames.push(variable+'_'+lat+'_'+lon+'.json');
    }
  }
}

next();

function next() {


  if (cmds.length === 0) {

    // keep files only if all variables are present
    for (var lat = latitude_mn; lat <= latitude_mx; lat+=grid) {
      for (var lon = longitude_mn; lon <= longitude_mx; lon+=grid) {
        
        // minimum to keep files is rr, tn and tx. tg may be calculated from tn & tx
        var missing = false;
        for (var v = 0; v < variables.length; v++) {
          if (!fs.existsSync('./json.gz/'+'rr_'+lat+'_'+lon+'.json.gz') ||
            !fs.existsSync('./json.gz/'+'tn_'+lat+'_'+lon+'.json.gz') ||
            !fs.existsSync('./json.gz/'+'tx_'+lat+'_'+lon+'.json.gz'))
            missing = true;
        }
        if (missing) { // remove all
          for (var v = 0; v < variables.length; v++) {
            if (fs.existsSync('./json.gz/'+variables[v]+'_'+lat+'_'+lon+'.json.gz'))
              fs.unlink('./json.gz/'+variables[v]+'_'+lat+'_'+lon+'.json.gz', function () { console.log(arguments); });
          }
        }

      }
    }

    return;
    
  }

  cmd = cmds.pop();
  fileName = fileNames.pop();
  variable = fileName.substr(0,2);

  exec(cmd, { maxBuffer: 1024*1024 }, function (error, stdout, stderr) {

      if (stdout.length === 0) {
        console.log('error: stdout empty');
      }
      if (stderr && stderr.length > 0) {
        console.log('stderr: ' + stderr);
        fs.appendFileSync('exec_stderr.txt', stderr);
      }
      if (error !== null) {
        console.log('exec error: ' + error);
        fs.appendFileSync('exec_error.txt', error);
      }
      
      var lines = stdout.split('\n')
        , line = null
        , val = '_'
        , json = { grid: grid, scale: -9999, latitude: -9999, longitude: -9999, t0: -9999, values: [] }
        ;
      for (var l = 0, ls = lines.length; l < ls; l++) {

        line = lines[l].split(' ');
        // console.log(line);
        
        if (line[0].trim().indexOf(variable) === 0) {

          if (lines[l].indexOf('scale_factor') > -1)
            json.scale = parseFloat(lines[l].split(' ')[lines[l].split(' ').length - 1]);

        } else if (lines[l].trim().length > 0) {

          if (line[0].indexOf('time[0]') === 0) {
            json.t0 = parseInt(line[0].split('=')[1]);
            json.latitude = parseFloat(line[1].split('=')[1]);
            json.longitude = parseFloat(line[2].split('=')[1]);
          }
            
          val = line[3].split('=')[1];
          if (val === '_')
            json.values.push(-9999);
          else
            json.values.push(parseInt(val));

        }

      }

      var avg = 0;
      if (json.values[0] === -9999) {
        avg = json.values.reduce(function (p, c) {
          return p + c;
        }, 0) / json.values.length;
      }

      if (avg != -9999) {

        console.log(fileName + ' ok');

        fs.writeFileSync('./json.gz/' + fileName, JSON.stringify(json, null, 2));
        exec('gzip -f ./json.gz/' + fileName, function (error, stdout, stderr) {
          if (stderr && stderr.length > 0)
            console.log('stderr: ' + stderr);
          if (error !== null)
            console.log('exec error: ' + error);

          next();
        });

      } else {
        console.log(fileName + ' avg = -9999');
        next();
      }

  });
};

