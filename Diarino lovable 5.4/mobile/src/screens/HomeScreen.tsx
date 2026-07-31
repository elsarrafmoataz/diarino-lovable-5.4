import { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? '');
    };

    void getUser();
  }, []);

  async function handleSignOut() {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      Alert.alert('Sign out failed', error.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Authenticated</Text>
        <Text style={styles.title}>Diarino mobile app</Text>
        <Text style={styles.subtitle}>You are now signed in and ready to use your native experience.</Text>
        {userEmail ? <Text style={styles.email}>{userEmail}</Text> : null}
        <Button title={loading ? 'Signing out...' : 'Sign out'} onPress={handleSignOut} disabled={loading} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#07111f',
  },
  card: {
    backgroundColor: '#0d1b2d',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#23415f',
  },
  eyebrow: {
    color: '#2dd4bf',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#8ba3c2',
    marginBottom: 12,
  },
  email: {
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 16,
  },
});
