import tkinter as tk
from tkinter import filedialog

class TextEditor:
    def __init__(self, master):
        self.master = master
        master.title("Simple Text Editor")
        self.text = tk.Text(master)
        self.text.pack(fill=tk.BOTH, expand=1)

        menu = tk.Menu(master)
        master.config(menu=menu)

        file_menu = tk.Menu(menu, tearoff=0)
        menu.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Open", command=self.open_file)
        file_menu.add_command(label="Save", command=self.save_file)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=master.quit)

    def open_file(self):
        file_path = filedialog.askopenfilename()
        if file_path:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            self.text.delete('1.0', tk.END)
            self.text.insert(tk.END, content)

    def save_file(self):
        file_path = filedialog.asksaveasfilename(
            defaultextension='.txt',
            filetypes=[('Text Files', '*.txt'), ('All Files', '*.*')]
        )
        if file_path:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(self.text.get('1.0', tk.END))

if __name__ == '__main__':
    root = tk.Tk()
    app = TextEditor(root)
    root.mainloop()
