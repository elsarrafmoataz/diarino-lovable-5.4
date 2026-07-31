import * as AuthSession from 'expo-auth-session';
import { useState } from 'react';
import { Alert, Button, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';

type SignInNavProp = StackNavigationProp<RootStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<SignInNavProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const redirectTo = Platform.OS === 'web'
      ? window.location.origin
      : AuthSession.makeRedirectUri({ scheme: 'diarino', useProxy: true });

    const { error, data } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    setLoading(false);

    if (error) {
      Alert.alert('Google sign in failed', error.message);
      return;
    }

    if (data?.url) {
      AuthSession.startAsync({ authUrl: data.url });
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue to Diarino.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#7f95b4"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#7f95b4"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={handleSignIn} disabled={loading} />

      <View style={styles.googleButtonContainer}>
        <Button title="Continue with Google" onPress={handleGoogleSignIn} disabled={loading} />
      </View>

      <Text style={styles.footerText} onPress={() => navigation.navigate('SignUp')}>
        Don&apos;t have an account? Create one
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#07111f',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#8ba3c2',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0d1b2d',
    borderColor: '#23415f',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#ffffff',
    marginBottom: 14,
  },
  googleButtonContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  footerText: {
    marginTop: 16,
    color: '#2dd4bf',
    textAlign: 'center',
    fontWeight: '600',
  },
});
