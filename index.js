var express = require("express");
var bodyParser = require("body-parser");
var mysql = require("mysql");
var util = require("util");
var session = require("express-session");
require("dotenv").config();

var conn = mysql.createConnection({
    host:"bcud1wbatfbojflwrlvu-mysql.services.clever-cloud.com",
    user:"uvbyu4fhi0f9aus0",
    password:"VBLt9v1rLwuvjpQVwBj1",
    database:""bcud1wbatfbojflwrlvu
});

var exe = util.promisify(conn.query).bind(conn);
var app = express();

//middle
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
    secret:"asdfghjkl",
    resave: true,
    saveUninitialized: true
}));

app.get("/",function(req,res){
    res.render("home.ejs");
});

app.get("/register",function(req,res){
    res.render("register.ejs");
});

app.post("/save_user",async function(req,res){
    var data = req.body;
    var user_name = data.first_name+" "+data.last_name;
    var sql = `INSERT INTO users (user_name, user_mobile, user_password) VALUES (?,?,?)`;
    var result = await exe(sql,[user_name, data.user_mobile, data.user_password]);

    res.redirect("/login");
});

app.get("/login",function(req,res){
    res.render("login.ejs");
});

app.post("/login_process",async function(req,res){
    var data = req.body;
    if(!data.user_mobile || !data.user_password) {
        return res.render("login.ejs"); // just reload login without error
    }
    var sql = `SELECT * FROM users WHERE user_mobile = ? AND user_password = ?`;
    var result = await exe(sql,[data.user_mobile, data.user_password]);
    if(result.length > 0){
        req.session.user_id = result[0].user_id;
        req.session.success =  "Login Successful! 🎉";
        res.redirect("/dashboard");
    }else{
        res.render("login.ejs", { error: "Invalid Mobile or Password" });
    }
});

function checkLogin(req,res,next)
{
     if(req.session.user_id == undefined)
    { 
        res.redirect("/login")
    }
    else
    {
        next()
    };
};

app.get("/dashboard",checkLogin,async function(req,res)
{
    var user_id = req.session.user_id;
    var sql = `SELECT * FROM users WHERE user_id = ?`;
    var user_info = await exe(sql,[user_id]);

    var success = req.session.success;
    req.session.success = null;

    var sql2 = `SELECT * FROM tasks WHERE task_status = 'Pending' AND user_id = ?`;
    var pending_tasks = await exe(sql2,[user_id]); 

    var sql3 = `SELECT * FROM tasks WHERE task_status = 'In Progress' AND user_id = ?`;
    var progress_tasks = await exe(sql3,[user_id]);

    var sql4 = `SELECT * FROM tasks WHERE task_status = 'Completed' AND user_id = ?`;
    var completed_tasks = await exe(sql4,[user_id]);

    var packet = {user_info,success,pending_tasks,progress_tasks,completed_tasks}; 
    res.render("dashboard.ejs",packet);
});

app.post("/add_task",checkLogin,async function(req,res){
    var data = req.body;
    data.task_status = 'Pending';
    data.user_id = req.session.user_id;

    var sql = `INSERT INTO tasks (task_title, task_description, task_priority, task_status, task_entry_date, user_id) VALUES (?,?,?,?,?,?)`;

    var result = await exe(sql,[data.task_title, data.task_description, data.task_priority, data.task_status, data.task_entry_date, data.user_id]);
    // res.send(result);
    res.redirect("/dashboard");
});


app.get("/start_task/:id",checkLogin,async function(req,res){

    var task_id = req.params.id;
    var task_status = "In Progress";
    var task_start_date = new Date().toLocaleDateString('en-CA');

    var sql = `UPDATE tasks SET task_status = ?, task_start_date = ? WHERE task_id = ?`;
    var result = await exe(sql,[task_status, task_start_date ,task_id]);
    // res.send(result);
    res.redirect("/dashboard");
});

app.get("/end_task/:id",checkLogin, async function(req,res){

    var task_id = req.params.id;
    var task_status = "Completed";
    var task_end_date = new Date().toLocaleDateString('en-CA');

    var sql = `UPDATE tasks SET task_status = ?, task_end_date = ? WHERE task_id = ?`;
    var result = await exe(sql,[task_status, task_end_date, task_id]);
    // res.send(result);
    res.redirect("/dashboard");
});

app.get("/back_to_pending/:id",async function(req,res){

    var task_id = req.params.id;
    var task_status = "Pending";

    var sql = `UPDATE tasks SET task_status = ? WHERE task_id = ?`;
    var result = await exe(sql,[task_status, task_id]);
    // res.send(result);
    res.redirect("/dashboard");

});

app.get("/back_to_processing/:id",async function(req,res){

    var task_id = req.params.id;
    var task_status = "In Progress";

    var sql = `UPDATE tasks SET task_status = ? WHERE task_id = ?`;
    var result = await exe(sql,[task_status, task_id]);
    // res.send(result);
    res.redirect("/dashboard");

});

app.get("/remove_task/:id",async function(req,res){

    var task_id = req.params.id;
    var sql = `DELETE FROM tasks WHERE task_id = ?`;
    var result = await exe(sql,[task_id]);
    // res.send(result);
    res.redirect("/dashboard");

});

app.get("/all_data",async function(req,res){

    var sql = `SELECT *,
                (SELECT COUNT(*) FROM tasks WHERE tasks.user_id = users.user_id ) as task_count,
                (SELECT COUNT(*) FROM tasks WHERE tasks.task_status = 'Pending' AND tasks.user_id = users.user_id ) as pending_count,
                (SELECT COUNT(*) FROM tasks WHERE tasks.task_status = 'In Progress' AND tasks.user_id = users.user_id ) as processing_count,
                (SELECT COUNT(*) FROM tasks WHERE tasks.task_status = 'Completed' AND tasks.user_id = users.user_id ) as completed_count
    FROM users`;
    var users = await exe(sql);
    var packet = {users};
    res.render("all_data.ejs",packet);
});

app.get("/pending_tasks/:user_id", async function(req, res) {
    var user_id = req.params.user_id;

    var sql = `SELECT * FROM tasks WHERE task_status = 'Pending' AND user_id = ?`;
    var user_pending_task = await exe(sql, [user_id]);

    var sql2 = `SELECT * FROM users WHERE user_id = ?`;
    var user_info = await exe(sql2, [user_id]);

    var packet = {user_pending_task, user_info};
    res.render("pending_tasks.ejs", packet); 
});

app.get("/processing_tasks/:user_id", async function(req, res) {
    var user_id = req.params.user_id;

    var sql = `SELECT * FROM tasks WHERE task_status = 'In Progress' AND user_id = ?`;
    var user_processing_task = await exe(sql, [user_id]);

    var sql2 = `SELECT * FROM users WHERE user_id = ?`;
    var user_info = await exe(sql2, [user_id]);

    console.log(user_processing_task);
    var packet = {user_processing_task, user_info};
    res.render("processing_tasks.ejs", packet); 
});


app.get("/completed_tasks/:user_id", async function(req, res) {
    var user_id = req.params.user_id;

    var sql = `SELECT * FROM tasks WHERE task_status = 'Completed' AND user_id = ?`;
    var user_completed_task = await exe(sql, [user_id]);

    var sql2 = `SELECT * FROM users WHERE user_id = ?`;
    var user_info = await exe(sql2, [user_id]);

    var packet = {user_completed_task, user_info};
    res.render("completed_tasks.ejs", packet); 
});

app.post("/update_task", checkLogin, async function(req, res) {
    var data = req.body;

    if (!data.task_id || !data.task_title || !data.task_priority) {
        return res.status(400).send("Missing fields");
    }

    var sql = `
        UPDATE tasks 
        SET task_title = ?, task_description = ?, task_priority = ? 
        WHERE task_id = ? AND user_id = ?
    `;

    await exe(sql, [
        data.task_title,
        data.task_description || "",
        data.task_priority,
        data.task_id,
        req.session.user_id
    ]);

    res.redirect("/dashboard");
});


app.listen(1000);
