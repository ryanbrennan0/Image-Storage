// modules
const express = require('express');
const app = express();
const http = require('http');
const url = require('url');
const fs = require('fs');
const sql = require('mysql');
const path = require('path');
const router = express.Router();
const bodyParser = require('body-parser');
const multer = require('multer');
const {PythonShell} = require('python-shell');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
var cookies = require("cookie-parser");

const jwtKey = "my_secret_key";
const jwtExpirySeconds = 300;

// to use static files - css, images ...
app.use(express.static(path.join(__dirname, 'public')));
// to use request to get post information from forms
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookies())
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.json())

var server = http.createServer(app);

// create mysql connection
var con = sql.createConnection({
    host: "localhost",
    user: "newuser",
    password: "InsideOutsideUpDown123!",
    database: "ImageStore"
});

// connect to mysql database
con.connect(function(err) {
    if (err) {
        throw err;
    }
    console.log("Connected!");
});

// read file for appropriate web page
function getPage(filename, req, res) {
    return fs.readFile(filename, function(err, data) {
        if (err) {
            res.writeHead(404, {'Content-Type': 'text/html'});
            return res.end("404 Not Found");
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        return res.end();
    });
}

// view.ejs
app.get('/view', (req, res) => {
    const token = req.cookies.token; // this
    if (!token) {
		return res.status(401).end()
	}
    var payload;
    try {
        payload = jwt.verify(token, jwtKey);
    } catch(e) {
        return res.status(400).end();
    }
    
    var username;
    jwt.verify(token, 'my_secret_key', function(err, decoded) {
        console.log(decoded.name)
        username = decoded.name;
    });

    var command = "SELECT userId FROM Users WHERE username = ?;";
    var arr = con.query(command, [username], (err, result) => {
        if (err) throw err;
        var string = JSON.stringify(result);
        var json =  JSON.parse(string);
        var user_id = json[0].userId;

        // get images from database
        var command = "SELECT * FROM Images WHERE userId = ?;";
        return con.query(command, [user_id], (err, results) => {
            if (err) throw err;
            res.render("view", {array : results});
        });
    }); 
});

// index.ejs
app.get('/', (req, res) => {
    const token = req.cookies.token; // this
    if (!token) {
		return res.status(401).end()
	}
    var payload;
    try {
        payload = jwt.verify(token, jwtKey);
    } catch(e) {
        return res.status(400).end();
    }
    res.render('index');
});

// upload.html
app.get('/upload', (req, res) => {
    const token = req.cookies.token; // this
    if (!token) {
		return res.status(401).end()
	}
    var payload;
    try {
        payload = jwt.verify(token, jwtKey);
    } catch(e) {
        return res.status(400).end();
    }
    getPage('upload.html', req, res);
});

// save image file
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // the file is saved to here
        cb(null, 'public/uploads')
    },
    filename: function (req, file, cb) {
        // the filename field is added or altered here once the file is uploaded
        cb(null, uuid.v4() + '.png')
    }
});

var upload = multer({ storage: storage })

// upload image to database
app.post('/upload', upload.single('file'), (req, res) => {
    
    var name = req.file.filename;
    var file = req.body.filename; // user inputted file name
    console.log(file);
    var location = 'uploads/' + name;

    let options = {
        mode: 'text',
        pythonOptions: ['-u'], // get print results in real-time
        scriptPath: '', // If you are having python_test.py script in same folder, then it's optional.
        args: [location] // file to encode (argument)
    };

    // run python script w/ options
    PythonShell.run('Encode.py', options, function (err, result){
        if (err) throw err;
        // get username from jwt token (cookie)
        var token = req.cookies.token;
        var username;
        jwt.verify(token, 'my_secret_key', function(err, decoded) {
            console.log(decoded.name)
            username = decoded.name;
        });

        // find userid using username
        var command = "SELECT userId FROM Users WHERE username = ?;";
        con.query(command, [username], (err, result) => {
            if (err) throw err;
            console.log(result);
            var string = JSON.stringify(result);
            var json =  JSON.parse(string);
            var user_id = json[0].userId;

            var y = name.substring(0, name.length - 4);
            var cb = name.substring(0, name.length - 4);
            var cr = name.substring(0, name.length - 4);
            y = "uploads/y_dct_" + y + ".pkl";
            cb = "uploads/cb_dct_" + cb + ".pkl";
            cr = "uploads/cr_dct_" + cr + ".pkl";

            // add image to database
            command = "INSERT INTO Images (userId, filename, location, Y, Cb, Cr) VALUES (?, ?, ?, ?, ?, ?)";
            con.query(command, [user_id, file, location, y, cb, cr], (err, result) => {
                if (err) throw err;
                console.log('success');

                try {
                    fs.unlinkSync("public/" + location); // THINK THIS IS RIGHT? - DELETE BLACK IMAGE AFTER WRITING PKL FILES
                } catch(err) {
                    console.error(err)
                }

            });
        }); 
    });
});

app.get('/login', (req, res) => {
    getPage('login.html', req, res);
});

// when logging in
app.post('/login', (req, res) => {
    var password = req.body.password;
    var username = req.body.username;
    var command = "SELECT * FROM Users WHERE username = '" + username + "' AND password = '" + password + "';";
    con.query(command, (err, rows) => {
        if(err) throw err;
        if (rows.length == 1) {
            // route to index
            const token = jwt.sign({ name: username }, jwtKey, {
                algorithm: "HS256",
                expiresIn: jwtExpirySeconds,
            })
            res.cookie("token", token, {maxAge: jwtExpirySeconds * 1000 })
            res.redirect('/')
        } else {
            console.log('error');
        }
    });
});

app.get('/register', (req, res) => {
    getPage('register.html', req, res);
});

// when registering
app.post('/register', (req, res) => {
    // add credentials to db
    // route them to login page
    var password = req.body.password;
    var username = req.body.username;
    var email = req.body.email;
    var command = "INSERT INTO Users (username, password, email) VALUES ('" + username +"', '" + password + "', '" + email + "');";
    con.query(command, (err, result) => {
        if (err) throw err;
        console.log('user added');
        res.redirect('/login');
    });
});

app.post('/image', (req, res) => {
    var name = req.body.value;
    console.log(name);
    var command = "SELECT * FROM Images WHERE filename = ?;";
    con.query(command, [name], (err, result) => {
        if (err) throw err;
        // return new page that displays just image
        var string = JSON.stringify(result);
        var json =  JSON.parse(string);

        var y = json[0].Y;
        var cb = json[0].Cb;
        var cr = json[0].Cr;
        var n = json[0].location;

        // TODO: DISPLAY IMAGE IN BROWSER
        let options = {
            mode: 'text',
            pythonOptions: ['-u'], // get print results in real-time
            scriptPath: '', // If you are having python_test.py script in same folder, then it's optional.
            args: [y,cb,cr] // file to encode (argument)
        };

        // decode image
        PythonShell.run('Decode.py', options, function (err, result){
            if (err) throw err;
            
            // XMLHTTPREQUEST CANNOT DO NODEJS REDIRECTS
            // var string = encodeURIComponent(n);
            // res.redirect('/view?valid=' + string);
            n = n.substring(0, n.length-3);
            n += "jpg";
            var redir = { image: n };
            return res.json(redir);
        });
    });
});

app.get('/viewImage', (req, res) => {
    console.log("/viewImage")
    var n = decodeURIComponent(req.query.valid);
    var b = __dirname + "/public/" + n;
    console.log(__dirname + "/public/" + n);

    var c = "public/" + n;

    fs.readFile(c, function(err, data) {
        if (err) throw err; // Fail if the file can't be read.
        res.writeHead(200, {'Content-Type': 'image/jpeg'});
        res.end(data); // Send the file data to the browser.
        try {
            fs.unlinkSync(c); // DELETE AFTER ITS IN USERS BROWSER
        } catch(err) {
            console.error(err)
        }
    });
});

// TODO: delete image
app.post('/delete', (req, res) => {
    var filename = req.body.value;
    var command = "SELECT * FROM Images WHERE filename = ?;";

    con.query(command, [filename], (err, result) => {
        var string = JSON.stringify(result);
        var json =  JSON.parse(string);

        var y = json[0].Y;
        var cb = json[0].Cb;
        var cr = json[0].Cr;

        command = "DELETE FROM Images WHERE filename = ?;";
        con.query(command, [filename], (err, result) => {
            if (err) throw err;
            console.log('deleted from database');

            // delete pickle files
            try {
                fs.unlinkSync("public/" + y);
                fs.unlinkSync("public/" + cb);
                fs.unlinkSync("public/" + cr);
            } catch(err) {
                console.error(err)
            }
            console.log('success');
        });
    });
});

// listen on port 8080
server.listen(8080, () => {
    console.log('listening on 8080');
});