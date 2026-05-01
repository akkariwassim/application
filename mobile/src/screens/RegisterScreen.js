import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { SHADOWS } from '../config/theme';

const RegisterSchema = Yup.object().shape({
  name:     Yup.string().required('Le nom complet est requis').min(2),
  email:    Yup.string().email('Email invalide').required('L\'email est requis'),
  password: Yup.string().min(6, 'Minimum 6 caractères').required('Le mot de passe est requis'),
  phone:    Yup.string().optional(),
});

export default function RegisterScreen({ navigation }) {
  const [showPwd, setShowPwd] = useState(false);
  const { register, error, isLoading, clearError } = useAuthStore();
  const { getColors } = useThemeStore();
  const COLORS = getColors();
  const styles = createStyles(COLORS);

  const handleRegister = async (values) => {
    clearError();
    await register(values);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="account-plus" size={44} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Inscription</Text>
          <Text style={styles.subtitle}>Rejoignez le futur de l'élevage</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
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
                <View style={styles.field}>
                  <Text style={styles.label}>Nom Complet</Text>
                  <View style={[styles.inputWrap, touched.name && errors.name && styles.inputError]}>
                    <Ionicons name="person-outline" size={18} color={COLORS.textDim} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="Ahmed Ben Ali"
                      placeholderTextColor={COLORS.textDim} value={values.name}
                      onChangeText={handleChange('name')} onBlur={handleBlur('name')} />
                  </View>
                  {touched.name && errors.name && <Text style={styles.err}>{errors.name}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <View style={[styles.inputWrap, touched.email && errors.email && styles.inputError]}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.textDim} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="votre@email.com"
                      placeholderTextColor={COLORS.textDim} keyboardType="email-address"
                      autoCapitalize="none" value={values.email}
                      onChangeText={handleChange('email')} onBlur={handleBlur('email')} />
                  </View>
                  {touched.email && errors.email && <Text style={styles.err}>{errors.email}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Mot de Passe</Text>
                  <View style={[styles.inputWrap, touched.password && errors.password && styles.inputError]}>
                    <Ionicons name="lock-closed-outline" size={18} color={COLORS.textDim} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="Min 6 caractères"
                      placeholderTextColor={COLORS.textDim} secureTextEntry={!showPwd}
                      value={values.password} onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')} />
                    <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                      <Ionicons name={showPwd ? 'eye-off-outline':'eye-outline'} size={18} color={COLORS.textDim}/>
                    </TouchableOpacity>
                  </View>
                  {touched.password && errors.password && <Text style={styles.err}>{errors.password}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Téléphone <Text style={styles.optional}>(optionnel)</Text></Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="call-outline" size={18} color={COLORS.textDim} style={styles.icon}/>
                    <TextInput style={styles.input} placeholder="+216 XX XXX XXX"
                      placeholderTextColor={COLORS.textDim} keyboardType="phone-pad"
                      value={values.phone} onChangeText={handleChange('phone')} />
                  </View>
                </View>

                <TouchableOpacity style={[styles.btn, isLoading && { opacity:0.6 }]}
                  onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
                  {isLoading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={styles.btnText}>Créer mon Compte</Text>}
                </TouchableOpacity>
              </>
            )}
          </Formik>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkRow}>
            <Text style={styles.linkText}>Déjà un compte ? <Text style={styles.link}>Se Connecter</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  scroll:      { flexGrow:1, padding:24, justifyContent:'center' },
  header:      { alignItems:'center', marginBottom:32 },
  logoBox:     { width:80, height:80, borderRadius:24, backgroundColor:COLORS.primary + '15', alignItems:'center', justifyContent:'center', marginBottom:16, borderWidth: 1, borderColor: COLORS.primary + '30' },
  title:       { fontSize:30, fontWeight:'900', color:COLORS.text, letterSpacing: -1 },
  subtitle:    { fontSize:15, color:COLORS.textMuted, marginTop:4, fontWeight: '500' },
  
  card:        { backgroundColor:COLORS.card, borderRadius:32, padding:24, borderWidth:1, borderColor:COLORS.border, ...SHADOWS.hard },
  errorBanner: { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.danger + '15', borderRadius:14, padding:14, marginBottom:20, gap:10, borderWidth: 1, borderColor: COLORS.danger + '30' },
  errorText:   { color:COLORS.danger, flex:1, fontSize:13, fontWeight: '600' },
  
  field:       { marginBottom:16 },
  label:       { fontSize:13, fontWeight:'700', color:COLORS.textMuted, marginBottom:6, marginLeft: 4 },
  optional:    { fontWeight:'400', fontSize:12 },
  inputWrap:   { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.background, borderRadius:16, borderWidth:1, borderColor:COLORS.border, paddingHorizontal:16 },
  inputError:  { borderColor:COLORS.danger },
  icon:        { marginRight:10 },
  input:       { flex:1, height:52, color:COLORS.text, fontSize:15, fontWeight: '600' },
  err:         { color:COLORS.danger, fontSize:12, marginTop:4, marginLeft: 4, fontWeight: '600' },
  
  btn:         { backgroundColor:COLORS.primary, borderRadius:16, height:56, alignItems:'center', justifyContent:'center', marginTop:12, ...SHADOWS.soft },
  btnText:     { color:COLORS.white, fontSize:16, fontWeight:'800' },
  
  linkRow:     { alignItems:'center', marginTop:24 },
  linkText:    { color:COLORS.textMuted, fontSize:14, fontWeight: '600' },
  link:        { color:COLORS.primary, fontWeight:'800' },
});
