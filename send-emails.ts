import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";

// Inisialisasi Resend dengan kunci API dari variabel lingkungan Supabase
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Endpoint untuk menerima permintaan dari frontend
serve(async (req) => {
    try {
        const url = new URL(req.url);
        const method = req.method;

        if (url.pathname === "/send-emails" && method === "POST") {
            const formData = await req.formData();
            const file = formData.get("file");
            const subject = formData.get("subject") as string;
            const message = formData.get("message") as string;

            if (!file || !subject || !message) {
                return new Response(JSON.stringify({ status: "error", message: "Missing required fields." }), { status: 400 });
            }

            // Membaca file dan mengubahnya menjadi string
            const fileContent = await (file as Blob).text();
            
            // Mem-parsing file CSV
            const records = await parse(fileContent, {
                skipFirstRow: true,
            }) as { email: string }[];
            
            const recipients = records.map(record => record.email);
            
            if (recipients.length === 0) {
                return new Response(JSON.stringify({ status: "error", message: "No recipients found in the file." }), { status: 400 });
            }

            // Mengirim email menggunakan Resend
            const { data, error } = await resend.emails.send({
                from: "onboarding@resend.dev", // Ganti dengan email terverifikasi Anda
                to: recipients,
                subject: subject,
                html: `<p>${message}</p>`,
            });

            if (error) {
                console.error("Resend API Error:", error);
                return new Response(JSON.stringify({ status: "error", message: "Failed to send emails via Resend." }), { status: 500 });
            }

            console.log("Emails sent successfully:", data);
            return new Response(JSON.stringify({ status: "success", message: "Emails sent." }), { status: 200 });
        }
    } catch (error) {
        console.error("Internal Server Error:", error);
        return new Response(JSON.stringify({ status: "error", message: "Internal server error." }), { status: 500 });
    }
});
