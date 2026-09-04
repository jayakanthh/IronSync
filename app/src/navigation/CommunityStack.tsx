import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommunityScreen from '../screens/community/CommunityScreen';
import CommunityDetailScreen from '../screens/community/CommunityDetailScreen';
import CommunityDiscoverScreen from '../screens/community/CommunityDiscoverScreen';
import CommunityCreateScreen from '../screens/community/CommunityCreateScreen';

const Stack = createNativeStackNavigator();

export default function CommunityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
      <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
      <Stack.Screen name="CommunityDiscover" component={CommunityDiscoverScreen} />
      <Stack.Screen name="CommunityCreate" component={CommunityCreateScreen} />
    </Stack.Navigator>
  );
}
