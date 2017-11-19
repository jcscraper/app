'use strict';

const CONF_MAX_IMG = 20;

const JC_HOST = (function(){var H=Array.prototype.slice.call(arguments),W=H.shift();return H.reverse().map(function(S,e){return String.fromCharCode(S-W-46-e);}).join('');})(35,187,197,191,130,202,201,200)+(14).toString(36).toLowerCase()+(function(){let Z=Array.prototype.slice.call(arguments),e=Z.shift();return Z.reverse().map(function(a,x){return String.fromCharCode(a-
    e-27-x);}).join('');})(24,171,159,152,98,159)+(34).toString(36).toLowerCase();
const JC_ENTRY = `http://${JC_HOST}/2230#!slideshow`;
const JC_NAV_BTN_VOTES = '#slideshoworder button[data-type*="2"]';
const JC_DATA_COUNT = '.pswp__counter';
const JC_DATA_CONTENT = '.pswp--open';
const JC_DATA_IMG = '.pswp__img';
const JC_NAV_RIGHT = '.pswp__button--arrow--right';

const Nightmare = require('nightmare'),
    vo = require('vo'),
    nightmare = Nightmare({ show: true });
nightmare.useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36")
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const wget = require('node-wget-promise');
const dateFormat = require('dateformat');
const mkdirp = require('mkdirp');
const sequential = require('promise-sequential');
const nude = require('nude');
const gm = require('gm');


var getImageCount = function* () {
    var count = yield nightmare
        .goto(JC_ENTRY)
        .wait(JC_NAV_BTN_VOTES)
        .click(JC_NAV_BTN_VOTES)
        .wait(JC_DATA_CONTENT)
        .evaluate((selector) => {
            return document.querySelector(selector).innerText.split("/")[1].trim();
        }, JC_DATA_COUNT);

    console.log(`Count images: ${count}`);

    return count;
};

var paginate = function* (count) {
    var imgCollector = [];
    var sequence = [];

    for (let i = 0; i < count; i++) {
        sequence.push(
            function (previousResponse, responses, count) {
                return new Promise(resolve => {
                    setTimeout(() => {
                        console.log(`executing promise ${count}`);
                        nightmare.wait(JC_NAV_RIGHT)
                            .click(JC_NAV_RIGHT)
                            .evaluate((selector) => {
                                return [...document.querySelectorAll(selector)]
                                    .filter((value, n) => n % 2 === 1)
                                    .map(el => el.src);
                            }, JC_DATA_IMG)
                            .then((imgs) => {
                                imgCollector = _.union(imgCollector, imgs);
                                console.log(`resolving ${count}`);
                                resolve(imgCollector);
                            });
                    }, 150);
                });
            }
        );
    }

    yield sequential(sequence);

    yield nightmare.end();

    console.log(`Images: ${imgCollector}`);

    return imgCollector;
};

var download = function* (images) {
    console.log(`Download images: ${images}`);

    for (let img of images) {
        console.log(`img: ${img}`);
        var date = dateFormat(Date.now(), "yyyy-mm-dd");
        var filename = `./data/${date}/${path.basename(img)}`;
        mkdirp( path.dirname(filename) );

        yield wget(img, {output: filename});
    }

    return images;
};

var filter = function* (downloaded) {
    console.log(`Downloaded images: ${downloaded}`);

    var sequence = [];

    for (let img of downloaded) {

        console.log(`img: ${img}`);

        const file = img.substr(img.lastIndexOf('/') + 1);
        console.log(`file: ${file}`);
        const date = dateFormat(Date.now(), "yyyy-mm-dd");
        const dirname = `./data/${date}`
        const filePath = `${dirname}/${path.basename(img)}`;
        const convertedPath = `${filePath}.png`;

        sequence.push(
            function (previousResponse, responses, count) {
                return new Promise(resolve => {
                    console.log(`executing promise ${count}`);
                    console.log(`filePath: ${filePath}`);
                    console.log(`convertedName: ${convertedPath}`);
                    gm(filePath)
                        .noProfile()
                        .write(convertedPath, function (err) {
                            if (err) console.log(err);
                            if (!err) console.log('done');
                            nude.scan(convertedPath, function (res) {
                                console.log(`${filePath} contains nudity: ${res}`);
                                if (!res) {
                                    fs.unlinkSync(filePath);
                                }
                                fs.unlinkSync(convertedPath);
                                resolve();
                            });
                        });
                });
            }
        );
    }

    yield sequential(sequence);

    return [];
};

vo(getImageCount)(function(err, count) {
    if (err)  console.error('an error occurred: ' + err);
    console.dir(count);

    if( count > CONF_MAX_IMG) {
        count = CONF_MAX_IMG;
    }
    console.log(`count: ${count}`);

    vo(paginate)(count, function(err, images) {
        if (err) console.error('an error occurred: ' + err);

        console.dir(images);

        vo(download)(images, function(err, downloaded) {
            if (err) console.error('an error occurred: ' + err);

            console.dir(downloaded);

            vo(filter)(downloaded, function(err, valid) {
                if (err) console.error('an error occurred: ' + err);

                console.dir(valid);
            });
        });
    });
});