// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

let runButton = document.getElementById('run-button');
let settingsButton = document.getElementById("settings-button");
let namesOnPage = [];
let viableGameData = [];
let nameIdHash = [];
let gameDataArray = [];
let currCountry = "CA";

const arrayColumn = (arr, n) => arr.map(x => x[n]);

$(function () {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
        let currURL = tabs[0].url;
        if (!currURL.includes("https://www.humblebundle.com/games")) {
            window.close();
        }
    });

    runButton.onclick = function () {
        showLoadingScreen();
        runApp();
    };

    settingsButton.onclick = function () {
        $('#settings').css({"zIndex" : "5", "display" : "block"});
        $('body').css({'width' : '150px'});

        document.getElementById("back-button").onclick = function () {
            $('#settings').css({"zIndex" : "-1", "display" : "none"});
            $('body').css({'width' : '100%'}).removeAttr('width');

        };

        let countryList = $("#country-list");
        countryList.onchange = function () {
            currCountry = countryList.options[countryList.selectedIndex].value;
        }
    }
});

function showLoadingScreen() {
    $('#loading').css({"zIndex" : "5"});
}

function removeLoadingScreen() {
    document.getElementById('loading').style.zIndex = "-1";
}

function runApp() {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {greeting: "getGameNames"}, function (response) {
            namesOnPage = response.response;
            parseNameData();
        });
    })
}

function parseNameData() {
    $.getJSON('http://api.steampowered.com/ISteamApps/GetAppList/v2/', generateLinkTable);
}

function generateLinkTable(nameData) {
    processAndInject(nameData);
    handleUnparsedGames();
    getPrices();
}

function processAndInject(nameData) {
    let tableHeader = '<tr id="table-header"><th>Game Name</th><th>Price</th></tr>';
    let tableList = $('#game-list');
    let allSteamGames = nameData.applist.apps;

    settingsButton.remove();
    runButton.remove();
    tableList.append(tableHeader);

    for (let i = 0; i < allSteamGames.length; i++) {
        for (let j = 0; j < namesOnPage.length; j++) {
            let normalizedGameName = normalizeString(namesOnPage[j]);
            if (allSteamGames[i].name === namesOnPage[j] || normalizeString(allSteamGames[i].name) === normalizedGameName) {
                let gameId = allSteamGames[i].appid;
                nameIdHash.push([namesOnPage[j], gameId, normalizedGameName]);
                gameDataArray.push(
                    {
                        name: namesOnPage[j],
                        id: gameId,
                        normalizedName : normalizedGameName,
                        price : getGamePrice(gameId)
                    }
                );

                let newGameRow = createNewGameRow(namesOnPage[j].toString());
                tableList.append(newGameRow);

                $(".game-link").get(nameIdHash.length - 1).href = "https://store.steampowered.com/app/" + gameId;
                break;
            }
        }
    }
    console.log(gameDataArray);
}

function getGamePrice(gameId) {
    let price = 0;
    $.ajax({
        async: false,
        dataType: "json",
        url: 'https://store.steampowered.com/api/appdetails/?appids=' + gameId + '&cc=' + currCountry + '&filters=price_overview',
        success: function (data) {
            let key = Object.keys(data);
            if (data[key].data.length === 0) {
                price = 0.00;
            } else {
                price = data[key].data.price_overview.final;
                price = price / 100;
            }
        }
    });
    return price;
}

function createNewGameRow(gameName) {
    return '<tr class="entry">' +
                '<td class="game-link-cell">' +
                    '<a class = game-link target="_blank" href="">' + gameName + '</a>' +
                    '</td><td class = "game-price">' +
                '</td>' +
            '</tr>';
}

function handleUnparsedGames() {
    let unParsedGames = namesOnPage.filter(x => !arrayColumn(nameIdHash, 0).includes(x));
    if (unParsedGames.length !== 0) {
        document.getElementById("size-manager").insertAdjacentHTML('beforeend', '<hr><table id="failed-list"><tr id="failed-table-header"><th>Unparsed Games</th></tr></table>');
        for (let i = 0; i < unParsedGames.length; i++) {
            document.getElementById("failed-list").insertAdjacentHTML('beforeend', '<tr class="entry"><td class="failed-game">' + unParsedGames[i] + '</td></tr>')
        }
    }
}

function getPrices() {
    $.each(nameIdHash, function (index) {
        parsePrices(nameIdHash[index][1]);
    });
}

function parsePrices(gameId) {
    $.ajax({
        async: false,
        dataType: "json",
        url: 'https://store.steampowered.com/api/appdetails/?appids=' + gameId + '&cc=' + currCountry + '&filters=price_overview',
        success: processPriceData
    });
}

function processPriceData(data) {
    viableGameData.push(data);

    if (nameIdHash.length === viableGameData.length) {
        injectPrices();
    }
}

function injectPrices() {
    for (let j = 0; j < viableGameData.length; j++) {
        let key = Object.keys(viableGameData[j]);
        let price;
        if (viableGameData[j][key].data.length === 0) {
            price = 0.00;
        } else {
            price = viableGameData[j][key].data.price_overview.final;
            price = price / 100;
        }
        nameIdHash[j].push(price);
        $(".game-price").get(j).textContent = "$" + price;
    }
    removeLoadingScreen();
    document.getElementById("content").style.height = window.getComputedStyle(document.getElementById("size-manager")).height;

    sendDataToBackground();
}

function sendDataToBackground() {
    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            greeting: "injectLinks",
            datatable: nameIdHash
        });
    })
}

function normalizeString(string) {
    return string.replace(/[^a-zA-Z0-9]/g, '');
}


