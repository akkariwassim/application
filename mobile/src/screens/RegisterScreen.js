import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import useAuthStore from '../store/authStore';

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  danger:'#EF4444', border:'rgba(255,255,255,0.08)',
};

const RegisterSchema = Yup.object().shape({
  name:     Yup.string().required('Full name is required').min(2),
  email:    Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string()
    .min(6, 'Minimum 6 characters')
    // .matches(/[A-Z]/, 'Must contain uppercase letter')
    // .matches(/[0-9]/, 'Must contain a number')
    .required('Password is required'),
  phone: Yup.string().optional(),
});

export default function RegisterScreen({ navigation }) {
  const [showPwd, setShowPwd] = useState(false);
  const { register, error, isLoading, clearError } = useAuthStore();

  const handleRegister = async (values) => {
    clearError();
    await register(values);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: COLORS.background }}
      behavior={Platform.OS==='ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="person-add" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start managing your herd today</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Formik
            initialValues={{ name:'', email:'', password:'', phone:'' }}
            validationSchema={RegisterSchema}
            onSubmit={handleRegister}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
              <>
                {/* Name */}
                <View style={styles.field}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={[styles.inputWrap, touched.name && errors.name && styles.inputError]}>
                    <Ionicons name="person-outline" size={18} color={COLORS.subtext} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="Ahmed Ben Ali"
                      placeholderTextColor={COLORS.subtext} value={values.name}
                      onChangeText={handleChange('name')} onBlur={handleBlur('name')} />
                  </View>
                  {touched.name && errors.name && <Text style={styles.err}>{errors.name}</Text>}
                </View>

                {/* Email */}
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <View style={[styles.inputWrap, touched.email && errors.email && styles.inputError]}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.subtext} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="your@email.com"
                      placeholderTextColor={COLORS.subtext} keyboardType="email-address"
                      autoCapitalize="none" value={values.email}
                      onChangeText={handleChange('email')} onBlur={handleBlur('email')} />
                  </View>
                  {touched.email && errors.email && <Text style={styles.err}>{errors.email}</Text>}
                </View>

                {/* Password */}
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={[styles.inputWrap, touched.password && errors.password && styles.inputError]}>
                    <Ionicons name="lock-closed-outline" size={18} color={COLORS.subtext} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="Min 8 chars, uppercase, number"
                      placeholderTextColor={COLORS.subtext} secureTextEntry={!showPwd}
                      value={values.password} onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')} />
                    <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                      <Ionicons name={showPwd ? 'eye-off-outline':'eye-outline'} size={18} color={COLORS.subtext}/>
                    </TouchableOpacity>
                  </View>
                  {touched.password && errors.password && <Text style={styles.err}>{errors.password}</Text>}
                </View>

                {/* Phone (optional) */}
                <View style={styles.field}>
                  <Text style={styles.label}>Phone <Text style={styles.optional}>(optional)</Text></Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="call-outline" size={18} color={COLORS.subtext} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="+216 XX XXX XXX"
                      placeholderTextColor={COLORS.subtext} keyboardType="phone-pad"
                      value={values.phone} onChangeText={handleChange('phone')} />
                  </View>
                </View>

                <TouchableOpacity style={[styles.btn, isLoading && { opacity:0.6 }]}
                  onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
                  {isLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Create Account</Text>}
                </TouchableOpacity>
              </>
            )}
          </Formik>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:      { flexGrow:1, padding:24, justifyContent:'center' },
  header:      { alignItems:'center', marginBottom:32 },
  logoCircle:  { width:72, height:72, borderRadius:36, backgroundColor:'rgba(79,70,229,0.15)', alignItems:'center', justifyContent:'center', marginBottom:12 },
  title:       { fontSize:26, fontWeight:'800', color:COLORS.text },
  subtitle:    { fontSize:14, color:COLORS.subtext, marginTop:4 },
  card:        { backgroundColor:COLORS.card, borderRadius:20, padding:24, borderWidth:1, borderColor:COLORS.border },
  errorBanner: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(239,68,68,0.1)', borderRadius:10, padding:12, marginBottom:16, gap:8 },
  errorText:   { color:COLORS.danger, flex:1, fontSize:13 },
  field:       { marginBottom:14 },
  label:       { fontSize:13, fontWeight:'600', color:COLORS.subtext, marginBottom:6 },
  optional:    { fontWeight:'400', fontSize:12 },
  inputWrap:   { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.surface, borderRadius:12, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:14 },
  inputError:  { borderColor:COLORS.danger },
  icon:        { marginRight:8 },
  input:       { flex:1, height:48, color:COLORS.text, fontSize:15 },
  err:         { color:COLORS.danger, fontSize:12, marginTop:4 },
  btn:         { backgroundColor:COLORS.primary, borderRadius:14, height:52, alignItems:'center', justifyContent:'center', marginTop:8 },
  btnText:     { color:'#fff', fontSize:16, fontWeight:'700' },
  linkRow:     { alignItems:'center', marginTop:20 },
  linkText:    { color:COLORS.subtext, fontSize:14 },
  link:        { color:COLORS.primary, fontWeight:'600' },
});
