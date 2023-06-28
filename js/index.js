/********************************************************************************************
 ********************************** Données et constantes ***********************************
 ********************************************************************************************/

/** 
 * Stockage des status de services SoftKiosk
 */
let skStatus = {}

/**
 * Stockage des paramètres applicatifs (répertoire dashkiosk)
 */
let appParams = {};

/**
 * ID de la page courante
 */
let currentPage = "home";

/**
 * Mode du lecteur de code barre (true en automatique, false en manuel)
 */
let isBarcodeAuto = false;

/**
 * Stockage de textes à afficher
 */
let barcodeFirstInstruction = "";
let payFirstInstruction = "Veuillez introduire votre carte bancaire";
let barcodeModeText = "";

/**
 * Liste des services requis pour exécuter les différents menu
 */
let useCaseServices = {
    "pay": ["CardPayment", "ReceiptPrinting", "TicketPrinting"],
    "barocde": ["BarcodeReading", "ReceiptPrinting"],
    "cash": ["CashPayment", "ReceiptPrinting"],
    "vitale": ["VitaleCardReading", "DocumentPrinting"]
}

/**
 * Stockage des données de formulaire
 */
let formData = {}

/**
 * Arguments d'appel par défaut pour lancement de transaction bancaire
 */
let defaultCbArgs = {
    "refTransaction": "test-0000",
    "refShoppingCart": "mon-ticket-1234",
    "amountInCents": 1000
}

/**
 * ID du menu sélectionné dans la page d'accueil
 */
let menuId = "";

/********************************************************************************************
 ********************************** Initialisation  *****************************************
 ********************************************************************************************/

/** Initialisation de l'application */
function initApp() {
    // Récupération des paramètres applicatifs
    appParams = Kiosk[Kiosk.current.app].appParams;

    // Récupération des status des services de la borne et écoute de leurs changements
    Kiosk.services.forEach(function (service) {
        // Interrogation préalable du status du service
        skStatus[service] = Kiosk[service].status;

        Kiosk[service].addEventListener("statusChange", function (e) {
            onStatusChange(e, service)
        });

        // Vérification du status
        checkStatus(service);
    });

    // Traitement particulier si le service de lecture de code barre existe
    if (skStatus.hasOwnProperty("BarcodeReading")) {
        // Récupération du mode de lecture
        isBarcodeAuto = Kiosk.BarcodeReading.isAutoTrigger;

        // Gestion des textes à afficher lors de la lecture de code barre selon le mode
        barcodeModeText = "Le lecteur de code barre est configuré en mode ";
        if (isBarcodeAuto) {
            barcodeModeText += "automatique";
            barcodeFirstInstruction = "En attente de scan d'un code barre...";
        }
        else {
            barcodeModeText += "manuel";
            barcodeFirstInstruction = "Appuyer sur le bouton 'Lancer la lecture' et scanner un code barre";
        }
    }

    Kiosk.Session.addEventListener("inactivityChange", function (e) {
        switch (e.data.dataType) {
            case 'MarkerReached':
                $("#sessionTimeout").removeClass("hidden");
                break;
            case 'Timeout':
                changePage("home");
                $("#sessionTimeout").addClass("hidden");
                break;
            case 'WatchReset':
                $("#sessionTimeout").addClass("hidden");
                break;
        }
    })

    // Passage du status de l'application à Ok
    updateAppStatus();
}


/********************************************************************************************
 ************************************** Navigation  *****************************************
 ********************************************************************************************/

// Initialisation de l'application
initApp();

// Gestion du DOM via jQuery
$(function () {

    // Affichage de la description contenue dans les paramètres applicatifs
    $(".desc-bar").append("<span>" + appParams.description + "</span>");

    // Masquage du bouton de demande de lecture de code barre dans le cas du mode automatique
    if (isBarcodeAuto) {
        $("#barcode-start").hide();
    }

    // Mise à jour des textes
    $("#barcode-instruction").html(barcodeFirstInstruction);
    $("#barcode-mode").html(barcodeModeText);
    $("#pay-instruction").html(payFirstInstruction);

    // Affichage des composants et de leurs status dans la "barre de status"
    for (let service in skStatus) {
        $(".status-bar").append("<span id='status-" + service + "'></span>");
        updateServiceDisplay(service);
    }

    // Gestion du clic sur la zone de retour à l'accueil
    $('.return-home').on("click", function () {
        console.log("Clic sur la zone de retour à la page d'accueil");
        // Changement de page -> accueil
        changePage('home');

    });

    // Gestion du clic sur un menu de la page d'accueil
    $(".home-menu").on("click", function () {
        console.log("Clic sur le bouton de menu dans la page d'accueil");

        // Récupération de l'ID du menu sélectionné
        menuId = $(this).attr("id");

        // Cas de sélection du menu "Page d'erreur"
        if (menuId === "error") {
            // Passage du status de l'application à Critical -> Basculement vers la page d'erreur, les champs statusDetail et statusDescription sont libres
            updateAppStatus(false);

            // Passage du status de l'application à Ok -> Retour à l'application au bout de 10s
            setTimeout(function () {
                updateAppStatus();
            }, 10000);
        }
        // Cas de sélection d'un menu ne nécessitant pas de service SK-V2
        else if (!useCaseServices.hasOwnProperty(menuId)) {
            // Changement de page -> menu sélectionné
            changePage(menuId);
        }
        // Cas de sélection d'un menu nécessitant des services SK-V2
        else {
            // Détermination de l'absence de services requis pour l'exécution du use case correspondant au menu
            let absentServices = useCaseServices[menuId].filter(function (service) { return !skStatus.hasOwnProperty(service) });
            // Si certains services nécessaires sont absents
            if (absentServices.length > 0) {
                // Affichage d'une boîte de dialogue
                alert("Impossible d'utiliser ce menu\nLes services suivants sont absents: " + absentServices.join(", "));
            }
            // Si tous les services requis sont présents
            else {
                // Changement de page -> menu sélectionné
                switch (menuId) {
                    case "pay":
                    case "cash":
                        changePage("pay-form");
                        break;
                    default:
                        changePage(menuId);
                        break;
                }
            }
        }
    });

    // Gestion du clic sur le bouton de confirmation d'un formulaire
    $(".form-submit").on("click", function () {
        console.log("Clic sur le bouton de confirmation de formulaire");
        // Stockage des données du formulaire dans la variable formData
        $("#page-" + currentPage + " form").find('input').each(function () {
            let attrName = $(this).attr("name");
            formData[attrName] = $(this).val();
        });

        // Changement de page -> page suivante
        switch (menuId) {
            case "form":
                changePage("home");
                break;
            default:
                changePage(menuId);
                break;
        }
    });

    // Gestion de l'arrivée sur la page de paiement CB
    $('#page-pay').on("pageshow", function () {
        // Ouverture d'une nouvelle session en vue d'utiliser le scénario de paiement
        Kiosk.Session.close({
            "information": "Nouvelle session utilisateur / Démarrage du scénario de paiement"
        });
        // Lancement du paiement
        startPayment("cb");
    });

    // Gestion de l'arrivée sur la page de paiement Cash
    $('#page-cash').on("pageshow", function () {
        // Ouverture d'une nouvelle session en vue d'utiliser le scénario de paiement Cash
        Kiosk.Session.close({
            "information": "Nouvelle session utilisateur / Démarrage du scénario de paiement"
        });
        // Lancement du paiement
        startPayment("cash");
    });

    // Gestion de l'arrivée sur la page de lecture de code barre
    $('#page-barcode').on("pageshow", function () {
        // Ouverture d'une nouvelle session en vue d'utiliser le scénario de lecture de code barre
        Kiosk.Session.close({
            "information": "Nouvelle session utilisateur / Démarrage du scénario de lecture code barre"
        });
        // Ecoute de l'événement de lecture de code barre
        Kiosk.BarcodeReading.addEventListener("barcodeRead", onBarcodeRead);
    });

    // Gestion du clic sur le bouton de lecture manuelle de code barre
    $("#barcode-start").on("click", function () {
        console.log("Clic sur le bouton de lancement manuel de la lecture de code barre");
        // Lancement de la lecture manuelle
        Kiosk.BarcodeReading.readBarcode();
    })

    // Gestion de l'arrivée sur la page de lecture de carte vitale
    $('#page-vitale').on("pageshow", function () {
        // Ecoute de l'événement de lecture (en tant que carte à puce)
        Kiosk.VitaleCardReading.addEventListener('cardRead', onCardRead);

        // Ecoute de l'événement de lecture (en tant que carte Vitale)
        Kiosk.VitaleCardReading.addEventListener('vitaleRead', onVitaleRead);

        // Ouverture d'une nouvelle session en vue d'utiliser le scénario de lecture de carte vitale
        Kiosk.Session.close({
            "information": "Nouvelle session utilisateur / Démarrage du scénario de lecture carte vitale"
        });
    });

    // Gestion de l'arrivée sur la page de fin de use case
    $('#page-thanks').on("pageshow", function () {
        // Changement de page -> accueil (au bout de 10s si l'utilisateur est encore sur la page de fin de use case)
        setTimeout(function () {
            if (currentPage === "thanks") {
                changePage('home');
            }
        }, 10000);
    });
});

/** Gestion du changement de page */
function changePage(newPage) {
    if (newPage === "home") {
        switch (menuId) {
            case "pay":
                Kiosk.CardPayment.removeEventListener("cardDebit", onCardDebit);
                Kiosk.CardPayment.removeEventListener("transactionConfirm", onTransactionConfirm);
                Kiosk.CardPayment.removeEventListener("receiptPrint", onReceiptPrint);
                Kiosk.TicketPrinting.removeEventListener("rawHtmlPrint", onTicketPrint);
                break;
            case "barcode":
                Kiosk.BarcodeReading.removeEventListener("barcodeRead", onBarcodeRead);
                Kiosk.ReceiptPrinting.removeEventListener("rawHtmlPrint", onReceiptPrint);
                break;
            case "cash":
                Kiosk.CashPayment.removeEventListener("transactionBank", onTransactionBank);
                Kiosk.CashPayment.removeEventListener("transactionConfirm", onTransactionConfirm);
                Kiosk.ReceiptPrinting.removeEventListener("rawHtmlPrint", onReceiptPrint);
                break;
            case "vitale":
                Kiosk.VitaleCardReading.removeEventListener('cardRead', onCardRead);
                Kiosk.VitaleCardReading.removeEventListener('vitaleRead', onVitaleRead);
                Kiosk.DocumentPrinting.removeEventListener("rawHtmlPrint", onDocumentPrint);
                break;
        }
        $("form").find('input').each(function () {
            $(this).val('');
        });
        $("#barcode-instruction").html(barcodeFirstInstruction);
        $("#pay-instruction").html(payFirstInstruction);
        $(".receipt-print").html("");
        formData = {};
        menuId = "";
    }
    else if (newPage === "pay-form") {
        $("#page-pay-form form").find('input').each(function () {
            let attrName = $(this).attr("name");
            $(this).val(defaultCbArgs[attrName]);
        });
    }
    $.mobile.changePage("#page-" + newPage);
    console.log("Changement de page : " + currentPage + " -> " + newPage);
    currentPage = newPage;
}

/**
 * Lancement de la transaction
 */
function startPayment(type) {
    // Actualisation de l'instruction à l'écran
    $("#pay-instruction").html("Veuillez introduire votre carte bancaire");

    // Récupération des arguments d'appel depuis le formulaire
    let payArgs = {};
    for (let argKey in defaultCbArgs) {
        payArgs[argKey] = formData[argKey] || defaultCbArgs[argKey];
    }

    switch (type) {
        case "cash":
            // Ecoute de l'événement de débit cash
            Kiosk.CashPayment.addEventListener("transactionBank", onTransactionBank);

            // Appel de lancement de la transaction
            Kiosk.CashPayment.bankTransaction(payArgs);
            break;
        case "cb":
        default:
            // Ecoute de l'événement de débit bancaire
            Kiosk.CardPayment.addEventListener("cardDebit", onCardDebit);

            // Appel de lancement de la transaction
            Kiosk.CardPayment.debitCard(payArgs);
            break;
    }
}

/**
 * Annulation de la transaction bancaire
 */
function cancelPayment() {
    // Choix du service de paiement selon le use case courant
    let paymentService = (menuId === "cash") ? "CashPayment" : "CardPayment";
    // Mise à jour de l'instruction de paiement
    $("#" + menuId + "-instruction").html("Annulation du paiement en cours...");
    // Ecoute de l'événement d'annulation de transaction
    Kiosk[paymentService].addEventListener("transactionCancel", onTransactionCancel);
    // Lancement de l'annulation de transaction
    Kiosk[paymentService].cancelTransaction();
}

/**
 * Impression de reçu suite à la lecture d'un code barre
 * @param {string} barcode - Code barre lu
 */
function printReceipt(barcode) {
    // Ecoute de l'événement d'impression de reçu
    Kiosk.ReceiptPrinting.addEventListener("rawHtmlPrint", onReceiptPrint);

    // Contenu du reçu à imprimer
    let html = '<html><meta charset="utf-8"><body style="font-size:80%; font-family:sans-serif; margin: 0px 20px;"><h1>Exemple de reçu</h1><h2>Votre commande</h2><hr /><ul><li>Lecture de code barre</li></ul><p>Votre code barre</p><p>' + barcode + '</p><hr /></body></html>';

    // Lancement de l'impression
    Kiosk.ReceiptPrinting.printRawHtml({
        "html": html
    });
}

/**
 * Impression de reçu suite à une transaction Cash
 * @param {object} info - Données de transaction
 */
function printCashReceipt(info) {
    // Ecoute de l'événement d'impression de reçu
    Kiosk.ReceiptPrinting.addEventListener("rawHtmlPrint", onReceiptPrint);

    // Contenu du reçu à imprimer
    let html = '<html><meta charset="utf-8"><body style="font-size:80%; font-family:sans-serif; margin: 0px 20px;">';

    if (info.dataType === "TransactionBankError") {
        html += '<h4>Erreur de paiement</h4>'
    }
    else {
        let total = info.confirmedAmount;
        var tvaPercent = 10;
        var totalHt = total / (1 + (tvaPercent / 100));
        var totalTva = total - totalHt;

        html += '<h4>Détail de la transaction:</h4><ul><li>Total: ' + formatAmount(total) + '</li><li>Montant inséré: ' + formatAmount(info.totalInserted) + '</li><li>Rendu: ' + formatAmount(info.totalReturned) + '</li></ul>\n\n<ul><li>Dont TVA: ' + totalTva + '</li><li>Total HT: ' + totalHt + '</li></ul>';
    }

    html += '</body></html>';
    // Lancement de l'impression
    Kiosk.ReceiptPrinting.printRawHtml({
        "html": html
    });
}

/**
 * Impression de reçu bancaire
 */
function printCbReceipt() {
    // Ecoute de l'événement d'impression de reçu CB
    Kiosk.CardPayment.addEventListener("receiptPrint", onReceiptPrint);

    // Impression au format utf-8
    Kiosk.CardPayment.printReceipt({
        "htmlHeader": "<h1 style='font-size: 20px; font-weight:bold; font-family: Verdana, sans-serif; text-align: center;'>Votre reçu</h1><h2  style='font-size: 15px; font-weight:bold; font-family: Verdana, sans-serif; text-align: center;'>Panier " + Kiosk.CardPayment.currentTransaction.refShoppingCart + "</h2><div><pre style='font-size: 14px; font-family: Verdana, sans-serif;'>",
        "htmlFooter": "</pre></div><hr><p style='font-family: Verdana, sans-serif; text-align: center;'>Au revoir</p>"
    });
}

/**
 * Mise à jour du status de l'application
 * @param {boolean} isAppOk - Indicateur de l'état désiré pour l'application
 */
function updateAppStatus(isAppOk = true) {
    // Construction du statusObject de l'application
    let appStatusObj = {
        "status": "Ok",
        "statusDetail": "Ok",
        "statusDescription": "Retour à l'application"
    };
    if (!isAppOk) {
        appStatusObj = {
            "status": "Critical",
            "statusDetail": "Test",
            "statusDescription": "Basculement vers la page d'erreur"
        }
    }

    // Mise à jour du status
    Kiosk[Kiosk.current.app].setApplicationStatus(appStatusObj);
}

/***************************************************************************************************
 ********************************** Gestion des événements *****************************************
 ***************************************************************************************************/

/**
 * Gestion du changement de status d'un service
 * @param {object} e - Données de l'événement de changement de status
 * @param {string} service - Nom du service concerné 
 */
function onStatusChange(e, service) {
    // Vérification de la cohérence entre le nom du service et l'expéditeur de l'événement
    if (service === e.sender) {
        // Stockage du nouveau status
        skStatus[service] = e.data.status;
        // Vérification du status
        checkStatus(service);
        // Mise à jour de l'affichage du status dans la barre
        updateServiceDisplay(service);
    }
}

/**
 * Gestion de l'événement de lecture de code barre
 * @param {object} e - Données de l'événement 
 */
function onBarcodeRead(e) {
    // Stockage de la ligne à afficher à l'écran
    let barcodeResult = "";
    // Cas de succès de lecture
    if (e.data.dataType === "BarcodeRead") {
        // Récupération du code lu
        let barcode = e.data.barcode;
        // Mise à jour de la ligne à afficher
        barcodeResult = "Code barre lu: " + e.data.barcode;
        // Affichage de l'information d'impression imminente
        $(".receipt-print").html("Impression de votre reçu en cours...");
        // Lancement de l'impression de reçu
        printReceipt(barcode);
    }
    // Cas d'échec d'impression
    else {
        // Mise à jour de la ligne à afficher
        barcodeResult = "Erreur de lecture code barre";
        // Affichage de l'information de non lancement d'impression
        $(".receipt-print").html("Pas d'impression de reçu");
    }
    console.log(barcodeResult);
    // Mise à jour du message correspondant à la lecture du code barre
    $("#barcode-instruction").html(barcodeResult);
    // Fin d'écoute de l'événement de lecture de code barre
    Kiosk.BarcodeReading.removeEventListener("barcodeRead", onBarcodeRead);
}

/**
 * Gestion de l'événement d'impression de reçu
 * @param {object} e - Données de l'événement 
 */
function onReceiptPrint(e) {
    // Changement de page -> fin
    changePage('thanks');
    // Fin d'écoute de l'événement d'impression de reçu
    Kiosk.ReceiptPrinting.removeEventListener("rawHtmlPrint", onReceiptPrint);
    // Affichage d'un message à l'écran selon la réussite ou l'échec d'impression
    if (e.data.dataType === "RawHtmlPrinted" || e.data.dataType === "ReceiptPrinted") {
        $(".receipt-print").html("Veuillez récupérer votre reçu");
    }
    else {
        $(".receipt-print").html("Erreur lors de l'impression du reçu");
    }
}

/**
 * Gestion de l'événement d'impression de ticket
 * @param {object} e - Données de l'événement 
 */
function onTicketPrint(e) {
    // Fin d'écoute de l'événement d'impression de ticket
    Kiosk.TicketPrinting.removeEventListener("rawHtmlPrint", onTicketPrint);
    // Cas de succès
    if (e.data.dataType === "RawHtmlPrinted") {
        // Ecoute de l'événement de confirmation de transaction
        Kiosk.CardPayment.addEventListener("transactionConfirm", onTransactionConfirm);
        // Lancement de la confirmation de transaction
        Kiosk.CardPayment.confirmTransaction({
            "confirmAmountInCents": Kiosk.CardPayment.currentTransaction.amountInCents
        });
        // Mise à jour de l'instruction de paiement
        $("#pay-instruction").html("Veuillez récupérer votre ticket");
    }
    else {
        // Mise à jour de l'instruction de paiement
        $("#pay-instruction").html("Erreur lors de l'impression du ticket");
        // Lancement de l'annulation de transaction
        cancelPayment();
    }
}

/**
 * Gestion de l'événement de débit bancaire
 * @param {object} e - Données de l'événement 
 */
function onCardDebit(e) {
    switch (e.data.dataType) {
        case "CardAcquired":
            // Mise à jour de l'instruction de paiement
            $("#pay-instruction").html("Carte bancaire introduite (type " + e.data.cardType + ")");
            break;
        case "TransactionAuthorized":
            // Mise à jour de l'instruction de paiement
            $("#pay-instruction").html("Transaction autorisée (" + e.data.refTransaction + ")");

            // Délivrance de biens - Impression de ticket
            deliverTicket();
            break;
        case "CardDebited":
            // Mise à jour de l'instruction de paiement
            $("#pay-instruction").html("Transaction terminée (" + e.data.refTransaction + ")");

            // Fin d'écoute de l'événement de débit
            Kiosk.CardPayment.removeEventListener("cardDebit", onCardDebit);

            // Impression du reçu
            printCbReceipt();
            break;
        case "CardDebitError":
            // Gestion des cas d'erreur
            handleDebitError(e.data.code);

            // Fin d'écoute de l'événement de débit
            Kiosk.CardPayment.removeEventListener("cardDebit", onCardDebit);

            // Impression du reçu
            printCbReceipt();
            break;
    }
}

/**
 * Gestion de l'événement de transaction Cash
 * @param {object} e - Données de l'événement 
 */
function onTransactionBank(e) {
    switch (e.data.dataType) {
        case "TransactionBanked":
            // Mise à jour de l'instruction de paiement
            $("#cash-instruction").html("Transaction terminée (" + e.data.refTransaction + ")");

            // Fin d'écoute de l'événement de débit
            Kiosk.CashPayment.removeEventListener("transactionBank", onTransactionBank);

            // Impression du reçu
            printCashReceipt(e.data);
            break;
        case "CashAccepted":
            // Mise à jour de l'instruction de paiement
            $("#cash-instruction").html("Montant inséré: " + formatAmount(e.data.value) + " | Total inséré: " + formatAmount(e.data.totalInserted));
            break;
        case "CashRejected":
            // Mise à jour de l'instruction de paiement
            $("#cash-instruction").html("Monnaie refusée par: " + e.data.source);
            break;
        case "TransactionAuthorized":
            // Mise à jour de l'instruction de paiement
            $("#cash-instruction").html("Transaction autorisée (" + e.data.refTransaction + ")");

            // Délivrance de biens dématérialisée
            deliver();
            break;
        case "TransactionBankError":
            // Gestion des cas d'erreur
            handleBankError(e.data.code);

            // Fin d'écoute de l'événement de débit
            Kiosk.CashPayment.removeEventListener("transactionBank", onTransactionBank);

            // Impression du reçu
            printCashReceipt(e.data);
            break;
    }

    /**
     * Fin d'écoute de l'événement transactionBank
     */
    Kiosk.CashPayment.removeEventListener("transactionBank", onTransactionBank);
}

/**
 * Gestion de l'événement de confirmation de transaction
 * @param {object} e - Données de l'événement 
 */
function onTransactionConfirm(e) {
    switch (e.data.dataType) {
        case "TransactionConfirmError":
            // Mise à jour de l'instruction de paiement
            $("#" + menuId + "-instruction").html("Erreur: désynchro applicative lors de la confirmation de la transaction");
            break;
    }
    // Choix du service de paiement selon le use case courant
    let paymentService = (menuId === "cash") ? "CashPayment" : "CardPayment";
    // Fin d'écoute de l'événement de confirmation de transaction
    Kiosk[paymentService].removeEventListener("transactionConfirm", onTransactionConfirm);
}

/**
 * Gestion de l'événement d'annulation de transaction
 * @param {object} e - Données de l'événement 
 */
function onTransactionCancel(e) {
    switch (e.data.dataType) {
        case "TransactionCancelError":
            // Mise à jour de l'instruction de paiement
            $("#" + menuId + "-instruction").html("Erreur: désynchro applicative lors de l'annulation de la transaction");
            break;
    }
    // Choix du service de paiement selon le use case courant
    let paymentService = (menuId === "cash") ? "CashPayment" : "CardPayment";
    // Fin d'écoute de l'événement d'annulation de transaction
    Kiosk[paymentService].removeEventListener("transactionCancel", onTransactionCancel);
}

/**
 * Gestion d'une erreur durant la transaction selon son code
 * @param {string} code - Code d'erreur
 */
function handleDebitError(code) {
    // Mise à jour de l'instruction de paiement
    switch (code) {
        case "StatusError":
            $("#pay-instruction").html("Erreur: Opération interdite dans le status actuel");
            break;
        case "StateError":
            $("#pay-instruction").html("Erreur: Opération interdite dans le state actuel");
            break;
        case "CardMute":
            $("#pay-instruction").html("Erreur: Carte muette");
            // Reproposition du paiement
            startPayment("cb");
            break;
        case "CardOutdated":
            $("#pay-instruction").html("Erreur: Carte périmée");
            // Reproposition du paiement
            startPayment("cb");
            break;
        case "Refused":
            $("#pay-instruction").html("Erreur: Transaction refusée");
            // Reproposition du paiement
            startPayment("cb");
            break;
        case "UserCancelled":
            $("#pay-instruction").html("Erreur: Transaction annulée par l'utilisateur depuis le terminal");
            // Reproposition du paiement
            startPayment("cb");
            break;
        case "ApplicationCancelled":
            $("#pay-instruction").html("Erreur: Transaction annulée par l'application");
            break;
        case "Server":
            $("#pay-instruction").html("Erreur: Serveur monétique injoignable");
            break;
        case "DeviceUnavailable":
            $("#pay-instruction").html("Erreur: Terminal indisponible");
            break;
        case "Hardware":
            $("#pay-instruction").html("Erreur: Problème matériel");
            break;
        default:
            $("#pay-instruction").html("Erreur: Erreur non traitée");
            break;
    }
}

/**
 * Gestion d'une erreur durant la transaction cash selon son code
 * @param {string} code - Code d'erreur
 */
function handleBankError(code) {
    // Mise à jour de l'instruction de paiement
    switch (code) {
        case "StatusError":
            $("#cash-instruction").html("Erreur: Opération interdite dans le status actuel");
            break;
        case "StateError":
            $("#cash-instruction").html("Erreur: Opération interdite dans le state actuel");
            break;
        case "Timeout":
            $("#cash-instruction").html("Erreur: Temps d'insertion monnaie écoulé lors de la transaction");
            break;
        case "ApplicationTimeout":
            $("#cash-instruction").html("Erreur: Inactivité applicative lors de la machine d'état de transaction");
            break;
        case "Hardware":
            $("#cash-instruction").html("Erreur: Problème matériel");
            break;
        case "FraudAttempt":
            $("#cash-instruction").html("Erreur: Tentative de fraude de l'utilisateur");
            break;
        case "Jam":
            $("#cash-instruction").html("Erreur: Périphérique en bourrage");
            break;
        case "CashUndefined":
            $("#cash-instruction").html("Erreur: Type de monnaie inconnue");
            break;
        case "ApplicationCancelled":
            $("#cash-instruction").html("Erreur: Transaction annulée par l'application");
            break;
        case "PayoutImpossible":
            $("#cash-instruction").html("Erreur: Impossible de rendre la monnaie");
            break;
        default:
            $("#cash-instruction").html("Erreur: Erreur non traitée");
            break;
    }
}

/**
 * Gestion d'une erreur durant la lecture de carte Vitale selon son code
 * @param {string} code - Code d'erreur
 */
function handleVitaleError(code) {
    switch (code) {
        case "NoCardInserted":
            $("#vitale-instruction").html("Erreur: La carte n’a pas été insérée ou elle a été arrachée");
            break;
        case "CardMute":
            $("#vitale-instruction").html("Erreur: La carte est muette");
            break;
        case "CardInvalid":
            $("#vitale-instruction").html("Erreur: La carte Vitale est invalide");
            break;
        case "StatusError":
            $("#vitale-instruction").html("Erreur: Opération interdite dans le status actuel");
            break;
        case "StateError":
            $("#vitale-instruction").html("Erreur: Opération interdite dans le state actuel");
            break;
        case "BadFormat":
            $("#vitale-instruction").html("Erreur: Problème dans le format de la requête envoyée");
            break;
        case "HttpTimeout":
            $("#vitale-instruction").html("Erreur: Temps de traitement de la commande expiré (timeout http)");
            break;
        case "AuthenticationError":
            $("#vitale-instruction").html("Erreur: Erreur d'authentification lors de l'execution de la commande");
            break;
        case "ConnectionError":
            $("#vitale-instruction").html("Erreur: Erreur de connexion au device Helio");
            break;
        default:
            $("#vitale-instruction").html("Erreur: Erreur non traitée");
            break;
    }
}

/**
 * Impression de ticket
 */
function deliverTicket() {
    // Mise à jour de l'instruction de paiement
    $("#pay-instruction").html("Impression de votre ticket en cours...");
    // Ecoute de l'événement d'impression de ticket
    Kiosk.TicketPrinting.addEventListener("rawHtmlPrint", onTicketPrint);
    // Impression de ticket
    Kiosk.TicketPrinting.printRawHtml({
        html: "<html><body><h1>Exemple de ticket</h1></body></html>"
    });
}

/**
 * Délivrance de bien dématérialisé
 */
function deliver() {
    // Mise à jour de l'instruction de paiement
    $("#cash-instruction").html("Délivrance de votre produit en cours...");

    let request = new XMLHttpRequest();

    try {
        request.open("GET", "https://api.ipify.org", false);
        request.send();
    }
    catch (error) {
        throw error;
    }

    if (request.status === 404) {
        // Mise à jour de l'instruction de paiement
        $("#cash-instruction").html("Erreur lors de la délivrance du produit");
        // Lancement de l'annulation de transaction
        cancelPayment();
    }
    else {
        // Ecoute de l'événement de confirmation de transaction
        Kiosk.CashPayment.addEventListener("transactionConfirm", onTransactionConfirm);
        // Lancement de la confirmation de transaction
        Kiosk.CashPayment.confirmTransaction({
            "confirmAmountInCents": Kiosk.CashPayment.currentTransaction.amountInCents
        });
        // Mise à jour de l'instruction de paiement
        $("#cash-instruction").html("Produit délivré");
    }
}

/**
 * Gestion de l'événement de lecture d'une carte à puce
 */
function onCardRead(e) {
    switch (e.data.dataType) {
        case 'CardDetected':
            // Mise à jour de l'instruction de lecture de carte Vitale
            $("#vitale-instruction").html("Carte Vitale détectée");
            // Lecture immédiate du contenu de la carte présente
            Kiosk.VitaleCardReading.readVitale({
                'timeout': 1
            });
            break;
        case 'CardRemoved':
            // Mise à jour de l'instruction de lecture de carte Vitale
            $("#vitale-instruction").html("Carte Vitale retirée");
            Kiosk.VitaleCardReading.removeEventListener('cardRead', onCardRead);
            break;
    }
}

/**
 * Gestion de l'événement de lecture d'une carte Vitale
 */
function onVitaleRead(e) {
    switch (e.data.dataType) {
        case 'VitaleRead':
            // Mise à jour de l'instruction de lecture de carte Vitale
            $("#vitale-instruction").html("Carte Vitale lue");
            printVitaleDocument(e.data.beneficiaires);
            break;
        case 'VitaleReadError':
            // Gestion des cas d'erreur
            handleVitaleError(e.data.code);
            break;
    }
    Kiosk.VitaleCardReading.removeEventListener('vitaleRead', onVitaleRead);
}

/**
 * Mise à jour de l'affichage du status d'un service
 * @param {string} service - Nom du service
 */
function updateServiceDisplay(service) {
    $("#status-" + service).html(service + " (" + skStatus[service] + ")");
}

/**
 * Mise en forme d'un montant
 * @param {number} amount - Montant en centimes
 * @returns 
 */
function formatAmount(amount) {
    return (amount / 100).toFixed(2) + ' &euro;';
}

/**
 * Vérification du status d'un service
 * @param {string} service - Nom du service
 */
function checkStatus(service) {
    switch (skStatus[service]) {
        case "Ok":
            console.log("Le service " + service + " est disponible sur la borne");

            // Basculement du clavier en mode automatique lorsque le service est disponible
            if (service === "OnscreenKbd") {
                Kiosk[service].autoShow = true;
            }
            break;
        case "Warning":
            console.warn("Le service " + service + " est partiellement disponible sur la borne");
            break;
        case "Critical":
            console.error("Le service " + service + " est indisponible sur la borne");
            break;
        case "TempUnavailable":
            console.error("Le service " + service + " est temporairement indisponible");
            break;
        default:
            console.error("Le service " + service + " est indisponible sur la borne");
            break;
    }
}
