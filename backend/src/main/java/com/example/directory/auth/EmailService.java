package com.example.directory.auth;

import com.example.directory.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final AppProperties properties;

    public void sendVerification(String email, String token) {
        String link = properties.getFrontendUrl() + "/verify-email?token=" + token;
        send(email, "Verify your email", "Open this link to verify your email: " + link
                + "\n\nIf you did not register, ignore this email.");
    }

    public void sendPasswordReset(String email, String token) {
        String link = properties.getFrontendUrl() + "/reset-password?token=" + token;
        send(email, "Reset your password", "Open this link to reset your password (valid for 30 minutes): "
                + link + "\n\nIf you did not request this, ignore this email.");
    }

    public void sendInvite(String email, String token, String role) {
        String link = properties.getFrontendUrl() + "/accept-invite?token=" + token;
        send(email, "You are invited to the business directory",
                "You have been invited as " + role + ". Set your password and enroll MFA here: " + link);
    }

    public void sendListingExpiryReminder(String email, String businessName, String date) {
        send(email, "Your listing expires soon",
                "The listing for " + businessName + " expires on " + date + ". Renew from the business portal.");
    }

    public void sendProfileNudge(String email, String name) {
        send(email, "Finish your profile", "Hi " + name + ", your business directory profile is waiting to be completed.");
    }

    private void send(String to, String subject, String body) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.warn("SMTP is not configured. Email to {} not sent. Subject: {}. Body: {}",
                    to, subject, body);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(properties.getMail().getFrom());
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
        } catch (Exception ex) {
            log.error("Could not send email to {}", to, ex);
        }
    }
}
