from PIL import Image
import numpy as np
import cv2
import math
import os
import sys
import skimage.util
import _pickle as cPickle

sys.argv[1] = "public/" + sys.argv[1]

image = cv2.imread(sys.argv[1])
image = cv2.cvtColor(image, cv2.COLOR_BGR2YCR_CB)
(y, cb, cr) = cv2.split(image)

def func(im):
    im = np.float32(im)/255.0
    return np.array(im)

y_new = func(y)
cb_new = func(cb)
cr_new = func(cr)

y_dct = cv2.dct(y_new)
cb_dct = cv2.dct(cb_new)
cr_dct = cv2.dct(cr_new)

n = sys.argv[1][15:]

name1 = "public/uploads/y_dct_" + n[:-4] + ".pkl"
name2 = "public/uploads/cb_dct_" + n[:-4] + ".pkl"
name3 = "public/uploads/cr_dct_" + n[:-4] + ".pkl"

cPickle.dump( y_dct, open( name1, "wb" ) )
cPickle.dump( cb_dct, open( name2, "wb" ) )
cPickle.dump( cr_dct, open( name3, "wb" ) )

res  = cv2.merge((y_dct, cb_dct, cr_dct))
res = np.float32(res)
result = cv2.cvtColor(res, cv2.COLOR_YCR_CB2BGR)

cv2.imwrite(sys.argv[1], result)