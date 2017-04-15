import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import alias from 'rollup-plugin-alias';

export default {
  plugins: [
    alias({
      'vue': 'node_modules/vue/dist/vue.esm.js'
    }),
    globals(),
    builtins(),
    babel(),
    nodeResolve({

    }),
    commonjs({
        // non-CommonJS modules will be ignored, but you can also
        // specifically include/exclude files
        
        
        // if true then uses of `global` won't be dealt with by this plugin
        ignoreGlobal: true,  // Default: false

        // if false then skip sourceMap generation for CommonJS modules
        sourceMap: true,  // Default: true
        
        namedExports: {
          // left-hand side can be an absolute path, a path
          // relative to the current directory, or the name
          // of a module in node_modules
        }
      }),

    ],
    
  entry: 'index.js',
  dest: 'index.bundle.js',
  format: 'iife'
};
