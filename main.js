var http = require('http');
var fs = require('fs');
var cheerio = require('cheerio');
var request = require('request');
var async = require('async'); //异步执行模块
var iconv = require('iconv-lite');
var mysql = require('mysql');

//mysql 部分
var connection = mysql.createConnection({
    host: '127.0.0.1', //172.16.0.20
    user: 'root',
    password: 'pany#1234',
    database:'test', // 前面建的user表位于这个数据库中
    port: 3306
});
connection.connect();

//查询
// connection.query('select * from `crawler`', function(err, rows, fields) {
//     if (err) throw err;
//     console.log('The solution is: ', rows);
// });
//关闭连接
//connection.end();
//添加
// connection.query('INSERT INTO crawler(city, price) VALUES(?,?)', ['北京','1000'], function(err, result) {
//     console.log(result)
//     // 释放连接 
// });
// connection.end();

//爬虫部分
var domainUrl = 'http://fangjia.fang.com/';
//任务队列
var q = async.queue(function(task, callback) {
    console.log('抓取' + task + '中的数据');
    nextRequest(task, function(res) {
        if (res == '2') {
            callback();
        } else {
            console.log(res)
        }
    })
}, 1);

//请求 转码
function loadPage(link, cb) {
    request
        .get({
            url: link,
            gzip: true,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, sdch',
                'Accept-Language': 'zh-CN,zh;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Pragma': 'no-cache',
                'Referer': 'https://www.google.com',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36'
            }

        })
        .on('error', function(err) {
            console.error('fail', link);
            cb(err);
        })
        .pipe(iconv.decodeStream('gbk'))
        .pipe(iconv.encodeStream('utf8'))
        .collect(function(err, data) {
            if (err) {
                console.error(err);
                return cb(err);
            }
            if (Buffer.isBuffer(data)) data = data.toString();
            cb(null, data);
        });

}


//初始化入口程序
var initPage = function(url,index,arr){
    if(index >= arr.length){
        return
    }else{
        q.push(url+arr[index]+'/', function(err) {
            console.log('finished processing item');
        });
        // assign a callback
        q.drain = function() {
            return initPage(url,index + 1,arr)
        };
    }
}

//抓取内容页
function nextRequest(url, fn) {
    loadPage(url,function(err, data){
        if (err) return console.error(err);
        var $ = cheerio.load(data);
        saveContent($,function(res){
            if(res == '1'){
                console.log('message has got');
                fn('2')
            }
        });
    })

}

//抓取内容页 text 部分
var messArr = [];
function saveContent($,fn){
    if($('.price-info dt>h3').text()){
        var Mess = {
            name: $('.price-info dt>h3').text(),
            price: $('.h-rate>h3').text()
        };
    }else if($('.inner-tab').eq(1).text()){
       var Mess = {
            name: $('.inner-tab').eq(1).text().trim(),
            price: $('.cj-esfInfo .cj-detail').find('em').eq(1).text()
        }; 
    }else{
        console.log('该城市信息不存在！')
    }
    fn('1')
    messArr.push(Mess);
    console.log(messArr)

    //建立连接，向表中插入值
    connection.query('INSERT INTO crawler(city, price) VALUES(?,?)', [Mess.name,Mess.price], function(err, result) {
       if(result.serverStatus == 2){
            console.log('存储信息成功！')
       }else{
            console.log('存储信息失败！')
       }
    });
    //connection.end();
}

var cityArr = ['wuhan','sjz','bj','tj','cd','zz']
initPage(domainUrl,0,cityArr)
