import { Linking } from 'react-native';
import MMKVStorage from "react-native-mmkv-storage";
import jwt_decode from "jwt-decode";
// import { MessagingInstance, setMessagingInstance } from '../services';
import { Messaging } from './Messaging';

import ReactNativeBiometrics from 'react-native-biometrics';
import { CustomTabs } from 'react-native-custom-tabs';
import { Fido } from './Fido';

import base64url from 'base64url';
import * as Colors from '../styles/colors';
import { StackNavigationProp } from '@react-navigation/stack';

const possibleScopes = [
    'openid',
    'profile',
    'profile_extended',
    'email',
    'phone',
    'gp_registration_details',
    'gp_integration_credentials',
    'client_metadata'
]

export interface Environment {
    client_id: string,
    url: string,
    name: string,
}

export interface AuthConfiguration {
    issuer: string,
    clientId: string,
    redirectUrl: string,
    scopes: string[],
    vtr: string
}

type WebViewType = "browser" | "webview" | "tab";

export class NhsLogin {
    static instance: NhsLogin;
    config: AuthConfiguration = {
        issuer: 'https://auth.sandpit.signin.nhs.uk',
        clientId: 'du-nhs-login',
        redirectUrl: 'https://du-nhs-login.herokuapp.com/code',
        scopes: ['openid', 'profile'],
        vtr: "[\"P0.Cp\"]"
    }

    nhsIdTokenPayload: any;

    idToken?: string;
    nhsAccessToken: string = "";

    appAccessToken: string = "";

    appServerUrl: string = "";

    chatEnabled: boolean = false;
    chatDisabledMessage: string = "";

    env: Environment = {
        client_id: "",
        name: "",
        url: ""
    };

    mmkv = new MMKVStorage.Loader().initialize();
    lastAuthorizationCode = ""

    fingerprintEnabled: boolean = false;

    constructor() {
        if (NhsLogin.instance){
            console.warn("NhsLogin instance already exists!");
            return;
        }
        this._constructor();
        Linking.addEventListener("url", this.onDeepLink);
        NhsLogin.instance = this;
    }

    async updateEnvironment(appServerUrl: string, env: Environment) {
        await this.mmkv.setStringAsync("server_url", appServerUrl);
        await this.mmkv.setMapAsync("env", env);
        this.appServerUrl = appServerUrl;
        this.env = env;
        this.updateConfigFromEnv();
    }

    updateConfigFromEnv() {
        this.config.clientId = this.env.client_id;
        this.config.issuer = this.env.url;
    }

    async _constructor() {
        this.appServerUrl = await this.mmkv.getStringAsync("server_url");
        const new_env = await this.mmkv.getMapAsync("env") as Environment;
        if (new_env && new_env.client_id) {
            this.env = new_env;
        }
        console.log(this.env);
        this.updateConfigFromEnv();

        const { biometryType } = await ReactNativeBiometrics.isSensorAvailable();
        this.fingerprintEnabled = (biometryType !== ReactNativeBiometrics.Biometrics);
    }

    readyToAuthorise() {
        return (this.config.clientId && this.config.clientId.length > 0);
    }

    buildAuthoriseUrl(): string {
        return this.config.issuer + `/authorize?client_id=${this.config.clientId}&scope=${this.config.scopes.join("%20")}&response_type=code&redirect_uri=${this.config.redirectUrl}`
    }

    onIdTokenReceived?: () => void;

    async onDeepLink(evt: { url: string }) {
        const _this = NhsLogin.instance;
        console.log(evt.url);
        var regex = /[?&]([^=#]+)=([^&#]*)/g,
            params: any = {},
            match;
        while (match = regex.exec(evt.url)) {
            params[match[1]] = match[2];
        }
        let { code } = params;
        if (!code || code == "undefined" || code == _this.lastAuthorizationCode) {
            code = undefined;
            return;
        }
        _this.lastAuthorizationCode = code;
        console.log("Authorization code: " + code);
        await _this.AuthorizationCodeExchange(code);
    }

    idTokenDecode(idToken: string) {
        const payload = jwt_decode(idToken);
        if (!payload){
            console.warn("No ID Token payload.");
            return;
        }
        NhsLogin.instance.nhsIdTokenPayload = payload;
        console.log(NhsLogin.instance.nhsIdTokenPayload);
    }

    async fingerprintLogin(webviewType: WebViewType, navigationContext: any, onComplete: () => void){
        const authResponse = await new Fido().auth();
        const authResponseJson = JSON.parse(authResponse);
        const message = authResponseJson.uafProtocolMessage;
        const url = this.buildAuthoriseUrl() + "&fido_auth_response=" + await new Fido().ToBase64Url(JSON.stringify(message));
        console.log(url);
        this.openInWebview(url, webviewType, navigationContext);
        
        NhsLogin.instance.onIdTokenReceived = onComplete;
    }

    openInWebview(url: string, webviewType: WebViewType, navigationContext: any){
        if (webviewType == "browser"){
            Linking.openURL(url);
        }
        if (webviewType == "webview"){
            navigationContext.navigate("LoginWebview", {
                url
            })
        }
        if (webviewType == "tab"){
            CustomTabs.openURL(url, {
                toolbarColor: Colors.Blue,
                enableDefaultShare: false,
                showPageTitle: false,
                enableUrlBarHiding: false,
            });
        }
    }

    NhsLoginAuthorise(webviewType: WebViewType, navigationContext: any, onComplete: () => void) {
        console.log(`Logging in with scopes: ${this.config.scopes}`);
        this.openInWebview(NhsLogin.instance.buildAuthoriseUrl(), webviewType, navigationContext)
        NhsLogin.instance.onIdTokenReceived = onComplete;
    }

    async AuthorizationCodeExchange(authCode: string) {
        console.log("Auth code exchange");
        const nhsAuthResponse = await fetch(this.appServerUrl + "/token?code=" + authCode + "&env=" + this.env.name, {
            method: "POST",
        }).then(async (res) => {
            return await res.json();
        }).catch(err => {
            console.log(err);
            return undefined;
        });
        if (!nhsAuthResponse) {
            return;
        }
        this.idTokenDecode(nhsAuthResponse.id_token);
        this.appAccessToken = nhsAuthResponse.access_token;
        this.chatEnabled = nhsAuthResponse.messaging_enabled;
        if (nhsAuthResponse.messaging_enabled){
            new Messaging(this.appServerUrl, this.appAccessToken);
        }
        else {
            this.chatDisabledMessage = nhsAuthResponse.messaging_disabled_reason;
        }
        this.nhsAccessToken = nhsAuthResponse.nhs_access_token;

        if (this.onIdTokenReceived) {
            this.onIdTokenReceived();
        }
    }

    GetScopes(): {
        name: string,
        enabled: boolean,
        disabled: boolean
    }[] {
        return possibleScopes.map((scope) => {
            return { name: scope, enabled: this.config.scopes.indexOf(scope) != -1, disabled: scope == 'openid' }
        })
    }

    SetScopes(scopes: string[]) {
        console.log(`new scopes: ${scopes}`);
        this.config.scopes = scopes;
    }
}

new NhsLogin();
