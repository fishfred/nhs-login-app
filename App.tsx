/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */
import 'react-native-gesture-handler';

import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import {WelcomeScreen} from './components/screens/WelcomeScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';

import { navigationRef } from "./components/RootNavigation";
import { OpenidSettingsScreen } from './components/screens/OpenidSettingsScreen';
import { NhsLogin } from './components/NhsLogin';

import * as Colors from './styles/colors';

export type RootStackParamList = {
  OpenidSettings: undefined,
  Welcome: undefined,
  Dashboard: undefined
}

const Stack = createStackNavigator<RootStackParamList>();
export const NhsLoginInstance = new NhsLogin();

declare const global: {HermesInternal: null | {}};

export default class App extends React.Component {
  render() {return (
    <>
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator headerMode="float" screenOptions={{
        headerTintColor: Colors.Blue,
        headerStyle: {
          backgroundColor: Colors.Blue
        }
      }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{
          header: WelcomeScreen.header,
        }}></Stack.Screen>
        <Stack.Screen name="Dashboard" component={DashboardScreen}></Stack.Screen>
        <Stack.Screen name="OpenidSettings" component={OpenidSettingsScreen} options={{
          header: OpenidSettingsScreen.header,
        }}></Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
    </>
  );
  }
}

