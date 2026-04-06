import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import useAuthStore from '../store/authStore';

const COLORS = {
  primary:    '#4F46E5',
  primaryDark:'#3730A3',
  background: '#0A0F1E',
  surface:    '#131929',
  card:       '#1E2A45',
  text:       '#F0F4FF',
  subtext:    '#94A3B8',
  danger:     '#EF4444',
  border:     'rgba(255,255,255,0.08)',
};

const LoginSchema = Yup.object().shape({
  email:    Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(6, 'Min 6 characters').required('Password is required'),
});

export default function LoginScreen({ navigation }) {
  const [showPwd, setShowPwd] = useState(false);
  const { login, error, isLoading, clearError } = useAuthStore();

  const handleLogin = async (values) => {
    clearError();
    const ok = await login(values.email, values.password);
    if (!ok) {
      // error is shown via store state
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Smart Fence</Text>
          <Text style={styles.subtitle}>Intelligent Livestock Management</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={LoginSchema}
            onSubmit={handleLogin}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <>
                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={[styles.inputWrap, touched.email && errors.email && styles.inputError]}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.subtext} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor={COLORS.subtext}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={values.email}
                      onChangeText={handleChange('email')}
                      onBlur={handleBlur('email')}
                    />
                  </View>
                  {touched.email && errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={[styles.inputWrap, touched.password && errors.password && styles.inputError]}>
                    <Ionicons name="lock-closed-outline" size={18} color={COLORS.subtext} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.subtext}
                      secureTextEntry={!showPwd}
                      value={values.password}
                      onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')}
                    />
                    <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                      <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.subtext} />
                    </TouchableOpacity>
                  </View>
                  {touched.password && errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.btn, isLoading && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Sign In</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </Formik>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
            <Text style={styles.linkText}>No account? <Text style={styles.link}>Create one</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  scroll:      { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header:      { alignItems: 'center', marginBottom: 36 },
  logoCircle:  { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(79,70,229,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:       { fontSize: 30, fontWeight: '800', color: COLORS.text, letterSpacing: 0.5 },
  subtitle:    { fontSize: 14, color: COLORS.subtext, marginTop: 4 },
  card:        { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  cardTitle:   { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginBottom: 16, gap: 8 },
  errorText:   { color: COLORS.danger, flex: 1, fontSize: 13 },
  fieldGroup:  { marginBottom: 16 },
  label:       { fontSize: 13, fontWeight: '600', color: COLORS.subtext, marginBottom: 6 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14 },
  inputError:  { borderColor: COLORS.danger },
  inputIcon:   { marginRight: 8 },
  input:       { flex: 1, height: 48, color: COLORS.text, fontSize: 15 },
  eyeBtn:      { padding: 4 },
  fieldError:  { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  btn:         { backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkRow:     { alignItems: 'center', marginTop: 20 },
  linkText:    { color: COLORS.subtext, fontSize: 14 },
  link:        { color: COLORS.primary, fontWeight: '600' },
});
